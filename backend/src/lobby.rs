use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, Weak};
use std::time::{Duration, Instant};

use rand::Rng;
use tokio::sync::broadcast;

use crate::protocol::TableSummary;
use crate::table::{Table, TableConfig};

const CODE_ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TICK: Duration = Duration::from_millis(250);

/// Most tables that can exist at once; creation is refused beyond this.
pub const MAX_TABLES: usize = 200;
/// How long a table with nobody connected and no humans seated survives.
const EMPTY_IDLE_TIMEOUT: Duration = Duration::from_secs(2 * 60);
/// How long a table with nobody connected but humans still seated survives,
/// so a player who drops can come back to their seat.
const SEATED_IDLE_TIMEOUT: Duration = Duration::from_secs(15 * 60);

pub struct TableHandle {
    code: String,
    table: Mutex<Table>,
    /// Pinged after every state change; each connection re-renders its view.
    pub updates: broadcast::Sender<()>,
    viewers: AtomicUsize,
}

impl TableHandle {
    pub fn lock(&self) -> MutexGuard<'_, Table> {
        self.table.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn notify(&self) {
        let _ = self.updates.send(());
    }

    pub fn viewers(&self) -> usize {
        self.viewers.load(Ordering::Relaxed)
    }
}

/// A connected viewer. Counts toward the table's viewers until dropped, which
/// keeps the table from being cleaned up while someone is watching.
pub struct Viewer {
    handle: Arc<TableHandle>,
}

impl Viewer {
    pub fn table(&self) -> &Arc<TableHandle> {
        &self.handle
    }
}

impl Drop for Viewer {
    fn drop(&mut self) {
        self.handle.viewers.fetch_sub(1, Ordering::Relaxed);
        self.handle.notify();
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct LobbyFull;

#[derive(Default)]
pub struct Lobby {
    tables: Mutex<HashMap<String, Arc<TableHandle>>>,
}

impl Lobby {
    fn tables(&self) -> MutexGuard<'_, HashMap<String, Arc<TableHandle>>> {
        self.tables.lock().unwrap_or_else(|p| p.into_inner())
    }

    pub fn create(self: &Arc<Self>, config: TableConfig) -> Result<Arc<TableHandle>, LobbyFull> {
        let handle = self.insert(config)?;
        spawn_ticker(Arc::downgrade(self), handle.clone());
        Ok(handle)
    }

    fn insert(&self, config: TableConfig) -> Result<Arc<TableHandle>, LobbyFull> {
        let mut tables = self.tables();
        if tables.len() >= MAX_TABLES {
            return Err(LobbyFull);
        }
        let code = loop {
            let code = random_code();
            if !tables.contains_key(&code) {
                break code;
            }
        };
        let (updates, _) = broadcast::channel(64);
        let handle = Arc::new(TableHandle {
            code: code.clone(),
            table: Mutex::new(Table::new(code.clone(), config)),
            updates,
            viewers: AtomicUsize::new(0),
        });
        tables.insert(code, handle.clone());
        Ok(handle)
    }

    pub fn get(&self, code: &str) -> Option<Arc<TableHandle>> {
        self.tables().get(&code.to_ascii_uppercase()).cloned()
    }

    /// Registers a viewer. Done under the lobby lock so a table can't be
    /// removed between being looked up and being joined.
    pub fn join(&self, code: &str) -> Option<Viewer> {
        let tables = self.tables();
        let handle = tables.get(&code.to_ascii_uppercase())?.clone();
        handle.viewers.fetch_add(1, Ordering::Relaxed);
        drop(tables);
        handle.notify();
        Some(Viewer { handle })
    }

    /// Removes the table if nobody is viewing it. Returns whether it was removed.
    fn remove_if_unwatched(&self, handle: &TableHandle) -> bool {
        let mut tables = self.tables();
        if handle.viewers() > 0 {
            return false;
        }
        tables.remove(&handle.code);
        true
    }

    /// Public tables only; private tables are reachable by code.
    pub fn public_summaries(&self) -> Vec<TableSummary> {
        let handles: Vec<Arc<TableHandle>> = self.tables().values().cloned().collect();
        let mut summaries: Vec<TableSummary> = handles
            .iter()
            .map(|h| h.lock().summary())
            .filter(|s| !s.private)
            .collect();
        summaries.sort_by(|a, b| a.name.cmp(&b.name));
        summaries
    }
}

/// Tracks how long a table has gone without viewers.
#[derive(Default)]
struct IdleTracker {
    since: Option<Instant>,
}

impl IdleTracker {
    /// Returns true once the table has been unwatched for longer than allowed.
    fn expired(&mut self, now: Instant, viewers: usize, humans_seated: bool) -> bool {
        if viewers > 0 {
            self.since = None;
            return false;
        }
        let since = *self.since.get_or_insert(now);
        let limit = if humans_seated { SEATED_IDLE_TIMEOUT } else { EMPTY_IDLE_TIMEOUT };
        now.duration_since(since) >= limit
    }

    fn reset(&mut self) {
        self.since = None;
    }
}

fn random_code() -> String {
    let mut rng = rand::rng();
    (0..6)
        .map(|_| CODE_ALPHABET[rng.random_range(0..CODE_ALPHABET.len())] as char)
        .collect()
}

fn spawn_ticker(lobby: Weak<Lobby>, handle: Arc<TableHandle>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(TICK);
        let mut idle = IdleTracker::default();
        loop {
            interval.tick().await;
            let now = Instant::now();
            let (changed, humans_seated) = {
                let mut table = handle.lock();
                (table.tick(now), table.has_humans())
            };
            if changed {
                handle.notify();
            }
            if idle.expired(now, handle.viewers(), humans_seated) {
                let Some(lobby) = lobby.upgrade() else { break };
                if lobby.remove_if_unwatched(&handle) {
                    tracing::info!(code = %handle.code, "removed idle table");
                    break;
                }
                // Someone joined just before the removal; keep running.
                idle.reset();
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> TableConfig {
        TableConfig {
            name: "test".into(),
            small_blind: 5,
            big_blind: 10,
            buy_in: 1000,
            max_seats: 6,
            private: false,
        }
    }

    #[test]
    fn creation_is_capped() {
        let lobby = Lobby::default();
        for _ in 0..MAX_TABLES {
            lobby.insert(config()).unwrap();
        }
        assert_eq!(lobby.insert(config()).err(), Some(LobbyFull));
    }

    #[test]
    fn unwatched_table_is_removed_and_frees_a_slot() {
        let lobby = Lobby::default();
        let handle = lobby.insert(config()).unwrap();
        assert!(lobby.remove_if_unwatched(&handle));
        assert!(lobby.get(&handle.code).is_none());
        assert!(lobby.tables().is_empty());
    }

    #[test]
    fn watched_table_is_kept_until_viewer_leaves() {
        let lobby = Lobby::default();
        let handle = lobby.insert(config()).unwrap();
        let viewer = lobby.join(&handle.code).unwrap();
        assert_eq!(handle.viewers(), 1);
        assert!(!lobby.remove_if_unwatched(&handle));
        assert!(lobby.get(&handle.code).is_some());

        drop(viewer);
        assert_eq!(handle.viewers(), 0);
        assert!(lobby.remove_if_unwatched(&handle));
        assert!(lobby.join(&handle.code).is_none());
    }

    #[test]
    fn idle_timeout_depends_on_seated_humans() {
        let start = Instant::now();
        let mut idle = IdleTracker::default();
        assert!(!idle.expired(start, 0, false));
        assert!(!idle.expired(start + EMPTY_IDLE_TIMEOUT - Duration::from_secs(1), 0, false));
        assert!(idle.expired(start + EMPTY_IDLE_TIMEOUT, 0, false));

        let mut idle = IdleTracker::default();
        assert!(!idle.expired(start, 0, true));
        assert!(!idle.expired(start + EMPTY_IDLE_TIMEOUT, 0, true));
        assert!(idle.expired(start + SEATED_IDLE_TIMEOUT, 0, true));
    }

    #[test]
    fn a_viewer_resets_the_idle_clock() {
        let start = Instant::now();
        let mut idle = IdleTracker::default();
        assert!(!idle.expired(start, 0, false));
        assert!(!idle.expired(start + EMPTY_IDLE_TIMEOUT, 1, false));
        assert!(!idle.expired(start + EMPTY_IDLE_TIMEOUT + Duration::from_secs(1), 0, false));
        assert!(idle.expired(start + EMPTY_IDLE_TIMEOUT * 2 + Duration::from_secs(1), 0, false));
    }
}
