use std::collections::HashMap;
use std::net::{IpAddr, Ipv6Addr};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
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
/// Most open tables a single client address can have created at once, so one
/// client can't take every slot.
pub const MAX_TABLES_PER_CLIENT: usize = 5;
/// How long a table that nobody has ever connected to survives. Kept short so
/// tables created and never used give their slot back quickly.
const UNJOINED_IDLE_TIMEOUT: Duration = Duration::from_secs(30);
/// Longest a table nobody has ever connected to can live, however often it is
/// looked up.
const UNJOINED_MAX_AGE: Duration = Duration::from_secs(5 * 60);
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
    /// Client that created the table (see `client_key`), for the per-client cap.
    creator: IpAddr,
    created: Instant,
    /// Set once a WebSocket connection has gone live.
    joined: AtomicBool,
    /// Set by a REST lookup; until the table is joined, the ticker takes it
    /// and resets the idle clock.
    touched: AtomicBool,
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

    fn take_touch(&self) -> bool {
        self.touched.swap(false, Ordering::Relaxed)
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

    /// Call once the WebSocket is live, so a failed or abandoned upgrade
    /// doesn't count the table as used.
    pub fn mark_joined(&self) {
        self.handle.joined.store(true, Ordering::Relaxed);
    }
}

impl Drop for Viewer {
    fn drop(&mut self) {
        self.handle.viewers.fetch_sub(1, Ordering::Relaxed);
        self.handle.notify();
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum CreateError {
    /// The lobby holds `MAX_TABLES` already.
    Full,
    /// This client already has `MAX_TABLES_PER_CLIENT` open tables.
    TooManyForClient,
}

#[derive(Default)]
pub struct Lobby {
    tables: Mutex<HashMap<String, Arc<TableHandle>>>,
}

impl Lobby {
    fn tables(&self) -> MutexGuard<'_, HashMap<String, Arc<TableHandle>>> {
        self.tables.lock().unwrap_or_else(|p| p.into_inner())
    }

    /// `creator` is the client's address; IPv6 addresses are grouped by /64.
    pub fn create(self: &Arc<Self>, config: TableConfig, creator: IpAddr) -> Result<Arc<TableHandle>, CreateError> {
        let handle = self.insert(config, creator)?;
        spawn_ticker(Arc::downgrade(self), handle.clone());
        Ok(handle)
    }

    fn insert(&self, config: TableConfig, creator: IpAddr) -> Result<Arc<TableHandle>, CreateError> {
        let creator = client_key(creator);
        let mut tables = self.tables();
        if tables.len() >= MAX_TABLES {
            return Err(CreateError::Full);
        }
        if tables.values().filter(|h| h.creator == creator).count() >= MAX_TABLES_PER_CLIENT {
            return Err(CreateError::TooManyForClient);
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
            creator,
            created: Instant::now(),
            joined: AtomicBool::new(false),
            touched: AtomicBool::new(false),
        });
        tables.insert(code, handle.clone());
        Ok(handle)
    }

    pub fn get(&self, code: &str) -> Option<Arc<TableHandle>> {
        self.tables().get(&code.to_ascii_uppercase()).cloned()
    }

    /// Looks up a table and, until someone has joined it, counts the lookup as
    /// activity so it isn't removed between the lookup and the join.
    pub fn touch(&self, code: &str) -> Option<Arc<TableHandle>> {
        let handle = self.get(code)?;
        handle.touched.store(true, Ordering::Relaxed);
        Some(handle)
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

#[derive(Clone, Copy, Default)]
struct Activity {
    viewers: usize,
    humans_seated: bool,
    ever_joined: bool,
    age: Duration,
}

/// Tracks how long a table has gone without viewers.
#[derive(Default)]
struct IdleTracker {
    since: Option<Instant>,
}

impl IdleTracker {
    /// Returns true once the table has been unwatched for longer than allowed.
    fn expired(&mut self, now: Instant, activity: Activity) -> bool {
        if activity.viewers > 0 {
            self.since = None;
            return false;
        }
        if !activity.ever_joined && activity.age >= UNJOINED_MAX_AGE {
            return true;
        }
        let since = *self.since.get_or_insert(now);
        let limit = if activity.humans_seated {
            SEATED_IDLE_TIMEOUT
        } else if !activity.ever_joined {
            UNJOINED_IDLE_TIMEOUT
        } else {
            EMPTY_IDLE_TIMEOUT
        };
        now.duration_since(since) >= limit
    }

    fn reset(&mut self) {
        self.since = None;
    }
}

/// Identifies a client for the per-client cap. One IPv6 client usually holds
/// a whole /64, so IPv6 addresses are grouped by that prefix.
fn client_key(ip: IpAddr) -> IpAddr {
    match ip.to_canonical() {
        IpAddr::V6(v6) => IpAddr::V6(Ipv6Addr::from(v6.to_bits() & !((1u128 << 64) - 1))),
        v4 => v4,
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
            let ever_joined = handle.joined.load(Ordering::Relaxed);
            if handle.take_touch() && !ever_joined {
                idle.reset();
            }
            let activity = Activity {
                viewers: handle.viewers(),
                humans_seated,
                ever_joined,
                age: now.duration_since(handle.created),
            };
            if idle.expired(now, activity) {
                let Some(lobby) = lobby.upgrade() else { break };
                if lobby.remove_if_unwatched(&handle) {
                    tracing::info!(code = %handle.code, humans_seated, "removed idle table");
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
    use std::net::Ipv4Addr;

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

    fn ip(n: u32) -> IpAddr {
        IpAddr::V4(Ipv4Addr::from(n))
    }

    fn idle(viewers: usize, humans_seated: bool) -> Activity {
        Activity {
            viewers,
            humans_seated,
            ever_joined: true,
            age: Duration::ZERO,
        }
    }

    #[test]
    fn creation_is_capped() {
        let lobby = Lobby::default();
        for n in 0..MAX_TABLES {
            lobby.insert(config(), ip(n as u32)).unwrap();
        }
        assert_eq!(lobby.insert(config(), ip(u32::MAX)).err(), Some(CreateError::Full));
    }

    #[test]
    fn creation_is_capped_per_client() {
        let lobby = Lobby::default();
        for _ in 0..MAX_TABLES_PER_CLIENT {
            lobby.insert(config(), ip(1)).unwrap();
        }
        assert_eq!(lobby.insert(config(), ip(1)).err(), Some(CreateError::TooManyForClient));
        assert!(lobby.insert(config(), ip(2)).is_ok());

        let first = lobby.tables().values().find(|h| h.creator == ip(1)).cloned().unwrap();
        assert!(lobby.remove_if_unwatched(&first));
        assert!(lobby.insert(config(), ip(1)).is_ok());
    }

    #[test]
    fn unwatched_table_is_removed_and_frees_a_slot() {
        let lobby = Lobby::default();
        let handle = lobby.insert(config(), ip(1)).unwrap();
        assert!(lobby.remove_if_unwatched(&handle));
        assert!(lobby.get(&handle.code).is_none());
        assert!(lobby.tables().is_empty());
    }

    #[test]
    fn watched_table_is_kept_until_viewer_leaves() {
        let lobby = Lobby::default();
        let handle = lobby.insert(config(), ip(1)).unwrap();
        let viewer = lobby.join(&handle.code).unwrap();
        assert_eq!(handle.viewers(), 1);
        assert!(!handle.joined.load(Ordering::Relaxed), "joined only once the socket is live");
        viewer.mark_joined();
        assert!(handle.joined.load(Ordering::Relaxed));
        assert!(!lobby.remove_if_unwatched(&handle));
        assert!(lobby.get(&handle.code).is_some());

        drop(viewer);
        assert_eq!(handle.viewers(), 0);
        assert!(lobby.remove_if_unwatched(&handle));
        assert!(lobby.join(&handle.code).is_none());
    }

    #[test]
    fn touch_marks_the_table_once() {
        let lobby = Lobby::default();
        let handle = lobby.insert(config(), ip(1)).unwrap();
        assert!(!handle.take_touch());
        assert!(lobby.touch(&handle.code.to_ascii_lowercase()).is_some());
        assert!(handle.take_touch());
        assert!(!handle.take_touch());
        assert!(lobby.touch("NOPE00").is_none());
    }

    #[test]
    fn idle_timeout_depends_on_seated_humans() {
        let start = Instant::now();
        let mut tracker = IdleTracker::default();
        assert!(!tracker.expired(start, idle(0, false)));
        assert!(!tracker.expired(start + EMPTY_IDLE_TIMEOUT - Duration::from_secs(1), idle(0, false)));
        assert!(tracker.expired(start + EMPTY_IDLE_TIMEOUT, idle(0, false)));

        let mut tracker = IdleTracker::default();
        assert!(!tracker.expired(start, idle(0, true)));
        assert!(!tracker.expired(start + EMPTY_IDLE_TIMEOUT, idle(0, true)));
        assert!(tracker.expired(start + SEATED_IDLE_TIMEOUT, idle(0, true)));
    }

    #[test]
    fn never_joined_table_expires_quickly() {
        let start = Instant::now();
        let unjoined = Activity::default();
        let mut tracker = IdleTracker::default();
        assert!(!tracker.expired(start, unjoined));
        assert!(!tracker.expired(start + UNJOINED_IDLE_TIMEOUT - Duration::from_secs(1), unjoined));
        assert!(tracker.expired(start + UNJOINED_IDLE_TIMEOUT, unjoined));
    }

    #[test]
    fn never_joined_table_has_a_max_age() {
        let start = Instant::now();
        let old = Activity {
            age: UNJOINED_MAX_AGE,
            ..Activity::default()
        };
        assert!(IdleTracker::default().expired(start, old));
        let joined = Activity { ever_joined: true, ..old };
        assert!(!IdleTracker::default().expired(start, joined));
    }

    #[test]
    fn ipv6_clients_are_grouped_by_slash_64() {
        let a: IpAddr = "2001:db8:1:2:aaaa::1".parse().unwrap();
        let b: IpAddr = "2001:db8:1:2:bbbb::2".parse().unwrap();
        let other: IpAddr = "2001:db8:1:3::1".parse().unwrap();
        assert_eq!(client_key(a), client_key(b));
        assert_ne!(client_key(a), client_key(other));
        let mapped: IpAddr = "::ffff:192.0.2.7".parse().unwrap();
        assert_eq!(client_key(mapped), "192.0.2.7".parse::<IpAddr>().unwrap());

        let lobby = Lobby::default();
        for _ in 0..MAX_TABLES_PER_CLIENT {
            lobby.insert(config(), a).unwrap();
        }
        assert_eq!(lobby.insert(config(), b).err(), Some(CreateError::TooManyForClient));
    }

    #[test]
    fn a_viewer_resets_the_idle_clock() {
        let start = Instant::now();
        let mut tracker = IdleTracker::default();
        assert!(!tracker.expired(start, idle(0, false)));
        assert!(!tracker.expired(start + EMPTY_IDLE_TIMEOUT, idle(1, false)));
        assert!(!tracker.expired(start + EMPTY_IDLE_TIMEOUT + Duration::from_secs(1), idle(0, false)));
        assert!(tracker.expired(start + EMPTY_IDLE_TIMEOUT * 2 + Duration::from_secs(1), idle(0, false)));
    }
}
