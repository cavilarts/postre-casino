use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use rand::Rng;
use tokio::sync::broadcast;

use crate::protocol::TableSummary;
use crate::table::{Table, TableConfig};

const CODE_ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TICK: Duration = Duration::from_millis(250);

pub struct TableHandle {
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

    pub fn viewer_joined(&self) {
        self.viewers.fetch_add(1, Ordering::Relaxed);
        self.notify();
    }

    pub fn viewer_left(&self) {
        self.viewers.fetch_sub(1, Ordering::Relaxed);
        self.notify();
    }
}

#[derive(Default)]
pub struct Lobby {
    tables: Mutex<HashMap<String, Arc<TableHandle>>>,
}

impl Lobby {
    pub fn create(&self, config: TableConfig) -> Arc<TableHandle> {
        let mut tables = self.tables.lock().unwrap_or_else(|p| p.into_inner());
        let code = loop {
            let code = random_code();
            if !tables.contains_key(&code) {
                break code;
            }
        };
        let (updates, _) = broadcast::channel(64);
        let handle = Arc::new(TableHandle {
            table: Mutex::new(Table::new(code.clone(), config)),
            updates,
            viewers: AtomicUsize::new(0),
        });
        tables.insert(code, handle.clone());
        spawn_ticker(handle.clone());
        handle
    }

    pub fn get(&self, code: &str) -> Option<Arc<TableHandle>> {
        let tables = self.tables.lock().unwrap_or_else(|p| p.into_inner());
        tables.get(&code.to_ascii_uppercase()).cloned()
    }

    /// Public tables only; private tables are reachable by code.
    pub fn public_summaries(&self) -> Vec<TableSummary> {
        let handles: Vec<Arc<TableHandle>> = {
            let tables = self.tables.lock().unwrap_or_else(|p| p.into_inner());
            tables.values().cloned().collect()
        };
        let mut summaries: Vec<TableSummary> = handles
            .iter()
            .map(|h| h.lock().summary())
            .filter(|s| !s.private)
            .collect();
        summaries.sort_by(|a, b| a.name.cmp(&b.name));
        summaries
    }
}

fn random_code() -> String {
    let mut rng = rand::rng();
    (0..6)
        .map(|_| CODE_ALPHABET[rng.random_range(0..CODE_ALPHABET.len())] as char)
        .collect()
}

fn spawn_ticker(handle: Arc<TableHandle>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(TICK);
        loop {
            interval.tick().await;
            let changed = handle.lock().tick(Instant::now());
            if changed {
                handle.notify();
            }
        }
    });
}
