use std::collections::{BTreeMap, VecDeque};
use std::time::{Duration, Instant};

use rand::seq::SliceRandom;
use serde::Serialize;

use crate::poker::card::{Card, full_deck};
use crate::poker::eval::{HandScore, best_hand, starting_hand};
use crate::protocol::{Action, ActionsView, Award, ChatMessage, Look, SeatView, TableSummary, TableView};

pub const ACTION_TIMEOUT: Duration = Duration::from_secs(30);
pub const NEXT_HAND_DELAY: Duration = Duration::from_secs(5);
pub const BOT_THINK: Duration = Duration::from_millis(1200);
const BOT_NAMES: [&str; 6] = ["Ace", "Bluff", "Chip", "Dealer", "Lucky", "River"];
const LOG_CAP: usize = 80;
const CHAT_CAP: usize = 100;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Stage {
    Waiting,
    Preflop,
    Flop,
    Turn,
    River,
    Showdown,
}

impl Stage {
    fn is_betting(self) -> bool {
        matches!(self, Stage::Preflop | Stage::Flop | Stage::Turn | Stage::River)
    }
}

#[derive(Clone, Debug)]
pub struct Seat {
    pub player_id: String,
    pub name: String,
    pub look: Look,
    pub stack: u64,
    /// Chips committed on the current street.
    pub bet: u64,
    /// Chips committed in the whole hand, used for side pots.
    pub invested: u64,
    pub hole: Vec<Card>,
    pub in_hand: bool,
    pub folded: bool,
    pub all_in: bool,
    pub acted: bool,
    /// Stood up mid-hand; removed once the hand ends.
    pub leaving: bool,
}

impl Seat {
    fn new(player_id: &str, name: &str, look: Look, stack: u64) -> Self {
        Self {
            player_id: player_id.to_string(),
            name: name.to_string(),
            look,
            stack,
            bet: 0,
            invested: 0,
            hole: Vec::new(),
            in_hand: false,
            folded: false,
            all_in: false,
            acted: false,
            leaving: false,
        }
    }

    fn live(&self) -> bool {
        self.in_hand && !self.folded
    }

    fn can_act(&self) -> bool {
        self.in_hand && !self.folded && !self.all_in
    }
}

pub struct TableConfig {
    pub name: String,
    pub small_blind: u64,
    pub big_blind: u64,
    pub buy_in: u64,
    pub max_seats: usize,
    pub private: bool,
}

struct Pot {
    amount: u64,
    eligible: Vec<usize>,
}

pub struct Table {
    pub code: String,
    pub config: TableConfig,
    pub seats: Vec<Option<Seat>>,
    pub button: Option<usize>,
    pub stage: Stage,
    pub board: Vec<Card>,
    deck: Vec<Card>,
    pub current_bet: u64,
    pub min_raise: u64,
    pub to_act: Option<usize>,
    /// Seat that acted last; the next action search starts after it.
    action_from: usize,
    pub deadline: Option<Instant>,
    next_hand_at: Option<Instant>,
    bot_due: Option<Instant>,
    pub awards: Vec<Award>,
    pub reveal: bool,
    hand_id: u64,
    log: VecDeque<String>,
    chat: VecDeque<ChatMessage>,
}

impl Table {
    pub fn new(code: String, config: TableConfig) -> Self {
        let min_raise = config.big_blind;
        let seats = (0..config.max_seats).map(|_| None).collect();
        Self {
            code,
            config,
            seats,
            button: None,
            stage: Stage::Waiting,
            board: Vec::new(),
            deck: Vec::new(),
            current_bet: 0,
            min_raise,
            to_act: None,
            action_from: 0,
            deadline: None,
            next_hand_at: None,
            bot_due: None,
            awards: Vec::new(),
            reveal: false,
            hand_id: 0,
            log: VecDeque::new(),
            chat: VecDeque::new(),
        }
    }

    pub fn summary(&self) -> TableSummary {
        TableSummary {
            code: self.code.clone(),
            name: self.config.name.clone(),
            small_blind: self.config.small_blind,
            big_blind: self.config.big_blind,
            buy_in: self.config.buy_in,
            max_seats: self.config.max_seats,
            private: self.config.private,
            players: self.seats.iter().flatten().count(),
            stage: self.stage,
        }
    }

    pub fn sit(&mut self, player_id: &str, name: &str, look: Look, seat: usize, now: Instant) -> Result<(), String> {
        if seat >= self.seats.len() {
            return Err("No such seat".into());
        }
        if self.seats[seat].is_some() {
            return Err("That seat is taken".into());
        }
        if self.seat_of(player_id).is_some() {
            return Err("You are already seated at this table".into());
        }
        self.seats[seat] = Some(Seat::new(player_id, name, look, self.config.buy_in));
        self.push_log(format!("{name} sat down in seat {}", seat + 1));
        self.schedule_next_hand(now);
        Ok(())
    }

    pub fn stand(&mut self, player_id: &str, now: Instant) -> Result<(), String> {
        let idx = self.seat_of(player_id).ok_or("You are not seated")?;
        let name = self.seat_name(idx);
        self.leave_seat(idx, &name, now);
        if !self.has_humans() {
            self.remove_bots(now);
        }
        Ok(())
    }

    pub fn add_bot(&mut self, now: Instant) -> Result<(), String> {
        let seat = self.seats.iter().position(|s| s.is_none()).ok_or("The table is full")?;
        let bots = self.seats.iter().flatten().filter(|s| s.player_id.starts_with("bot:")).count();
        let name = BOT_NAMES[bots % BOT_NAMES.len()];
        use rand::Rng;
        let id = format!("bot:{:x}", rand::rng().random::<u64>());
        let look = random_look();
        self.seats[seat] = Some(Seat::new(&id, name, look, self.config.buy_in));
        self.push_log(format!("{name} sat down in seat {}", seat + 1));
        self.schedule_next_hand(now);
        Ok(())
    }

    pub fn remove_bots(&mut self, now: Instant) {
        let bots: Vec<usize> = (0..self.seats.len())
            .filter(|&i| self.seats[i].as_ref().is_some_and(|s| s.player_id.starts_with("bot:")))
            .collect();
        for idx in bots {
            if self.seats[idx].is_some() {
                let name = self.seat_name(idx);
                self.leave_seat(idx, &name, now);
            }
        }
    }

    fn has_humans(&self) -> bool {
        self.seats.iter().flatten().any(|s| !s.player_id.starts_with("bot:"))
    }

    fn is_bot(&self, idx: usize) -> bool {
        self.seats[idx].as_ref().is_some_and(|s| s.player_id.starts_with("bot:"))
    }

    fn leave_seat(&mut self, idx: usize, name: &str, now: Instant) {
        if self.seat(idx).in_hand {
            self.seat_mut(idx).leaving = true;
            self.push_log(format!("{name} leaves the table"));
            if !self.seat(idx).folded {
                self.take_action(idx, Action::Fold, now);
            }
        } else {
            self.seats[idx] = None;
            self.push_log(format!("{name} left the table"));
            self.schedule_next_hand(now);
        }
    }

    pub fn act(&mut self, player_id: &str, action: Action, now: Instant) -> Result<(), String> {
        let idx = self.seat_of(player_id).ok_or("You are not seated at this table")?;
        if self.to_act != Some(idx) {
            return Err("It's not your turn".into());
        }
        self.validate(idx, action)?;
        self.take_action(idx, action, now);
        Ok(())
    }

    pub fn chat(&mut self, name: &str, text: &str) {
        if self.chat.len() == CHAT_CAP {
            self.chat.pop_front();
        }
        self.chat.push_back(ChatMessage {
            name: name.to_string(),
            text: text.to_string(),
        });
    }

    /// Advances timers. Returns true when the state changed.
    pub fn tick(&mut self, now: Instant) -> bool {
        if let (Some(idx), Some(due)) = (self.to_act, self.bot_due) {
            if now >= due {
                self.bot_due = None;
                let action = self.bot_action(idx);
                self.take_action(idx, action, now);
                return true;
            }
        }
        if let (Some(idx), Some(deadline)) = (self.to_act, self.deadline) {
            if now >= deadline {
                let name = self.seat_name(idx);
                let to_call = self.current_bet.saturating_sub(self.seat(idx).bet);
                self.push_log(format!("{name} ran out of time"));
                let action = if to_call == 0 { Action::Check } else { Action::Fold };
                self.take_action(idx, action, now);
                return true;
            }
        }
        if let Some(at) = self.next_hand_at {
            if now >= at {
                self.start_hand(now);
                return true;
            }
        }
        false
    }

    pub fn view(&self, viewer: Option<&str>, viewers: usize, now: Instant) -> TableView {
        let you = viewer.and_then(|p| self.seat_of(p));
        let pot: u64 = self.seats.iter().flatten().map(|s| s.invested).sum();

        let seats = self
            .seats
            .iter()
            .enumerate()
            .map(|(i, slot)| {
                slot.as_ref().map(|s| {
                    let show = !s.hole.is_empty() && (Some(i) == you || self.stage == Stage::Showdown);
                    SeatView {
                        seat: i,
                        name: s.name.clone(),
                        look: s.look,
                        is_bot: s.player_id.starts_with("bot:"),
                        stack: s.stack,
                        bet: s.bet,
                        in_hand: s.in_hand,
                        folded: s.folded,
                        all_in: s.all_in,
                        leaving: s.leaving,
                        is_you: Some(i) == you,
                        is_button: self.button == Some(i),
                        is_turn: self.to_act == Some(i),
                        hole: if show { s.hole.iter().map(|c| c.code()).collect() } else { Vec::new() },
                    }
                })
            })
            .collect();

        let actions = you.filter(|&i| self.to_act == Some(i)).map(|i| {
            let seat = self.seat(i);
            let to_call = self.current_bet.saturating_sub(seat.bet);
            let max_raise_to = seat.bet + seat.stack;
            ActionsView {
                can_check: to_call == 0,
                to_call: to_call.min(seat.stack),
                min_raise_to: (self.current_bet + self.min_raise).min(max_raise_to),
                max_raise_to,
            }
        });

        TableView {
            code: self.code.clone(),
            name: self.config.name.clone(),
            small_blind: self.config.small_blind,
            big_blind: self.config.big_blind,
            buy_in: self.config.buy_in,
            max_seats: self.config.max_seats,
            private: self.config.private,
            stage: self.stage,
            board: self.board.iter().map(|c| c.code()).collect(),
            pot,
            current_bet: self.current_bet,
            min_raise: self.min_raise,
            button: self.button,
            to_act: self.to_act,
            turn_ms_left: self
                .deadline
                .map(|d| d.saturating_duration_since(now).as_millis() as u64),
            seats,
            you,
            actions,
            hand_id: self.hand_id,
            your_hand: you.and_then(|i| self.hand_description(i)),
            awards: self.awards.clone(),
            reveal: self.reveal,
            log: self.log.iter().cloned().collect(),
            chat: self.chat.iter().cloned().collect(),
            viewers,
        }
    }

    fn hand_description(&self, idx: usize) -> Option<String> {
        let seat = self.seats[idx].as_ref()?;
        if !seat.in_hand || seat.hole.len() != 2 {
            return None;
        }
        if self.board.len() < 3 {
            return Some(starting_hand(seat.hole[0], seat.hole[1]));
        }
        let mut cards = seat.hole.clone();
        cards.extend_from_slice(&self.board);
        Some(best_hand(&cards).describe())
    }

    fn seat(&self, idx: usize) -> &Seat {
        self.seats[idx].as_ref().expect("seat is occupied")
    }

    fn seat_mut(&mut self, idx: usize) -> &mut Seat {
        self.seats[idx].as_mut().expect("seat is occupied")
    }

    fn seat_name(&self, idx: usize) -> String {
        self.seats[idx].as_ref().map(|s| s.name.clone()).unwrap_or_default()
    }

    fn seat_of(&self, player_id: &str) -> Option<usize> {
        self.seats
            .iter()
            .position(|slot| slot.as_ref().is_some_and(|s| s.player_id == player_id))
    }

    /// First occupied seat after `from` (cyclic) that matches `pred`.
    fn next_seat(&self, from: usize, pred: impl Fn(&Seat) -> bool) -> Option<usize> {
        let n = self.seats.len();
        (1..=n)
            .map(|k| (from + k) % n)
            .find(|&i| self.seats[i].as_ref().is_some_and(&pred))
    }

    fn eligible_count(&self) -> usize {
        self.seats
            .iter()
            .flatten()
            .filter(|s| s.stack > 0 && !s.leaving)
            .count()
    }

    fn push_log(&mut self, msg: String) {
        if self.log.len() == LOG_CAP {
            self.log.pop_front();
        }
        self.log.push_back(msg);
    }

    fn schedule_next_hand(&mut self, now: Instant) {
        if self.stage.is_betting() {
            return;
        }
        if self.eligible_count() >= 2 {
            if self.next_hand_at.is_none() {
                self.next_hand_at = Some(now + NEXT_HAND_DELAY);
            }
        } else {
            self.next_hand_at = None;
        }
    }

    /// Rough hand strength from 0.0 (trash) to 1.0 (monster).
    fn hand_strength(&self, idx: usize) -> f64 {
        let seat = self.seat(idx);
        if self.board.len() < 3 {
            let (a, b) = (seat.hole[0], seat.hole[1]);
            let hi = a.rank.max(b.rank) as f64;
            let lo = a.rank.min(b.rank) as f64;
            if a.rank == b.rank {
                return (0.5 + hi / 28.0).min(0.99);
            }
            let mut s = (hi + lo) / 40.0;
            if a.suit == b.suit {
                s += 0.06;
            }
            if hi - lo <= 2.0 {
                s += 0.05;
            }
            s.min(0.95)
        } else {
            let mut cards = seat.hole.clone();
            cards.extend_from_slice(&self.board);
            let category = best_hand(&cards).category() as f64;
            (0.15 + 0.1 * category).min(0.99)
        }
    }

    /// Simple strength-and-pot-odds policy. The result is always legal.
    fn bot_action(&self, idx: usize) -> Action {
        use rand::Rng;
        let mut rng = rand::rng();
        let seat = self.seat(idx);
        let strength = self.hand_strength(idx);
        let to_call = self.current_bet.saturating_sub(seat.bet);
        let max_to = seat.bet + seat.stack;
        let min_to = self.current_bet + self.min_raise;
        let pot: u64 = self.seats.iter().flatten().map(|s| s.invested).sum();
        let roll: f64 = rng.random();

        let raise = |fraction: f64| -> Action {
            if min_to > max_to {
                return Action::Call;
            }
            let target = (self.current_bet as f64 + (pot + to_call) as f64 * fraction).round() as u64;
            let target = target.clamp(min_to, max_to);
            if target >= max_to {
                Action::AllIn
            } else {
                Action::Raise { amount: target }
            }
        };

        if to_call == 0 {
            if strength > 0.72 && roll < 0.6 {
                raise(0.6)
            } else if strength < 0.3 && roll < 0.08 {
                raise(0.5)
            } else {
                Action::Check
            }
        } else {
            let odds = to_call as f64 / (pot + to_call) as f64;
            if strength > 0.85 && roll < 0.5 {
                raise(1.0)
            } else if strength >= odds + 0.1 || (strength >= odds && roll < 0.5) {
                Action::Call
            } else {
                Action::Fold
            }
        }
    }

    fn validate(&self, idx: usize, action: Action) -> Result<(), String> {
        let seat = self.seat(idx);
        match action {
            Action::Check => {
                let to_call = self.current_bet.saturating_sub(seat.bet);
                if to_call > 0 {
                    return Err(format!("You must call {to_call} or fold"));
                }
                Ok(())
            }
            Action::Raise { amount } => {
                let max_to = seat.bet + seat.stack;
                if amount <= self.current_bet {
                    return Err("A raise must be larger than the current bet".into());
                }
                if amount > max_to {
                    return Err("You don't have that many chips".into());
                }
                let min_to = self.current_bet + self.min_raise;
                if amount < min_to && amount != max_to {
                    return Err(format!("Minimum raise is to {min_to}"));
                }
                Ok(())
            }
            Action::Fold | Action::Call | Action::AllIn => Ok(()),
        }
    }

    fn take_action(&mut self, idx: usize, action: Action, now: Instant) {
        let name = self.seat_name(idx);
        let to_call = self.current_bet.saturating_sub(self.seat(idx).bet);
        match action {
            Action::Fold => {
                self.seat_mut(idx).folded = true;
                self.push_log(format!("{name} folds"));
            }
            Action::Check => self.push_log(format!("{name} checks")),
            Action::Call if to_call == 0 => self.push_log(format!("{name} checks")),
            Action::Call => {
                let pay = to_call.min(self.seat(idx).stack);
                self.commit(idx, pay);
                let suffix = if self.seat(idx).all_in { " (all-in)" } else { "" };
                self.push_log(format!("{name} calls {pay}{suffix}"));
            }
            Action::AllIn => {
                let total = self.seat(idx).bet + self.seat(idx).stack;
                if total > self.current_bet {
                    self.raise_to(idx, total);
                } else {
                    let pay = self.seat(idx).stack;
                    self.commit(idx, pay);
                    self.push_log(format!("{name} calls {pay} (all-in)"));
                }
            }
            Action::Raise { amount } => self.raise_to(idx, amount),
        }

        if self.to_act == Some(idx) {
            self.to_act = None;
            self.deadline = None;
            self.bot_due = None;
            self.action_from = idx;
        }
        self.seat_mut(idx).acted = true;
        self.advance(now);
    }

    fn commit(&mut self, idx: usize, amount: u64) {
        let seat = self.seat_mut(idx);
        let amount = amount.min(seat.stack);
        seat.stack -= amount;
        seat.bet += amount;
        seat.invested += amount;
        if seat.stack == 0 {
            seat.all_in = true;
        }
    }

    fn raise_to(&mut self, idx: usize, to: u64) {
        let name = self.seat_name(idx);
        let prev = self.current_bet;
        let delta = to - self.seat(idx).bet;
        self.commit(idx, delta);

        let size = to - prev;
        if size >= self.min_raise {
            self.min_raise = size;
        }
        self.current_bet = to;

        for (i, slot) in self.seats.iter_mut().enumerate() {
            if let Some(seat) = slot {
                if i != idx && seat.can_act() {
                    seat.acted = false;
                }
            }
        }

        let verb = if prev == 0 { "bets" } else { "raises to" };
        let suffix = if self.seat(idx).all_in { " (all-in)" } else { "" };
        self.push_log(format!("{name} {verb} {to}{suffix}"));
    }

    /// Seat that must act next, or None when the betting round is complete.
    fn next_to_act(&self) -> Option<usize> {
        let cb = self.current_bet;
        let able = self.seats.iter().flatten().filter(|s| s.can_act()).count();
        self.next_seat(self.action_from, |s| {
            s.can_act() && (!s.acted || s.bet < cb) && !(able <= 1 && s.bet >= cb)
        })
    }

    fn advance(&mut self, now: Instant) {
        loop {
            let live = self.seats.iter().flatten().filter(|s| s.live()).count();
            if live <= 1 {
                return self.resolve(now);
            }
            if let Some(idx) = self.next_to_act() {
                if self.to_act != Some(idx) {
                    self.to_act = Some(idx);
                    self.deadline = Some(now + ACTION_TIMEOUT);
                    self.bot_due = self.is_bot(idx).then(|| now + BOT_THINK);
                }
                return;
            }
            if self.stage == Stage::River {
                return self.resolve(now);
            }
            self.next_street();
        }
    }

    fn next_street(&mut self) {
        for seat in self.seats.iter_mut().flatten() {
            seat.bet = 0;
            seat.acted = false;
        }
        self.current_bet = 0;
        self.min_raise = self.config.big_blind;
        self.action_from = self.button.unwrap_or(0);

        let (count, stage, label) = match self.stage {
            Stage::Preflop => (3, Stage::Flop, "Flop"),
            Stage::Flop => (1, Stage::Turn, "Turn"),
            _ => (1, Stage::River, "River"),
        };
        for _ in 0..count {
            if let Some(card) = self.deck.pop() {
                self.board.push(card);
            }
        }
        self.stage = stage;
        let board = self.board.iter().map(|c| c.code()).collect::<Vec<_>>().join(" ");
        self.push_log(format!("{label}: {board}"));
    }

    fn start_hand(&mut self, now: Instant) {
        for seat in self.seats.iter_mut().flatten() {
            seat.hole.clear();
            seat.bet = 0;
            seat.invested = 0;
            seat.folded = false;
            seat.all_in = false;
            seat.acted = false;
            seat.in_hand = seat.stack > 0 && !seat.leaving;
        }
        self.next_hand_at = None;

        let n = self.seats.len();
        let players: Vec<usize> = (0..n)
            .filter(|&i| self.seats[i].as_ref().is_some_and(|s| s.in_hand))
            .collect();
        if players.len() < 2 {
            return;
        }

        let prev = self.button.unwrap_or(n - 1);
        let button = self.next_seat(prev, |s| s.in_hand).unwrap_or(players[0]);
        let (sb, bb) = if players.len() == 2 {
            let other = self.next_seat(button, |s| s.in_hand).unwrap_or(button);
            (button, other)
        } else {
            let sb = self.next_seat(button, |s| s.in_hand).unwrap_or(button);
            let bb = self.next_seat(sb, |s| s.in_hand).unwrap_or(sb);
            (sb, bb)
        };

        self.button = Some(button);
        self.hand_id += 1;
        self.deck = full_deck();
        self.deck.shuffle(&mut rand::rng());
        self.board.clear();
        self.awards.clear();
        self.reveal = false;
        self.stage = Stage::Preflop;

        let (small, big) = (self.config.small_blind, self.config.big_blind);
        let sb_name = self.seat_name(sb);
        let bb_name = self.seat_name(bb);
        let button_name = self.seat_name(button);
        self.push_log(format!("New hand. {button_name} has the button"));
        let sb_pay = small.min(self.seat(sb).stack);
        self.commit(sb, small);
        self.push_log(format!("{sb_name} posts small blind {sb_pay}"));
        let bb_pay = big.min(self.seat(bb).stack);
        self.commit(bb, big);
        self.push_log(format!("{bb_name} posts big blind {bb_pay}"));
        self.current_bet = self.seat(sb).bet.max(self.seat(bb).bet);
        self.min_raise = big;

        let order: Vec<usize> = (1..=n)
            .map(|k| (button + k) % n)
            .filter(|i| players.contains(i))
            .collect();
        for _ in 0..2 {
            for &i in &order {
                if let Some(card) = self.deck.pop() {
                    self.seat_mut(i).hole.push(card);
                }
            }
        }

        self.action_from = bb;
        self.advance(now);
    }

    fn build_pots(&self) -> Vec<Pot> {
        let mut levels: Vec<u64> = self
            .seats
            .iter()
            .flatten()
            .map(|s| s.invested)
            .filter(|&v| v > 0)
            .collect();
        levels.sort_unstable();
        levels.dedup();

        let mut pots: Vec<Pot> = Vec::new();
        let mut prev = 0;
        for level in levels {
            let mut amount = 0;
            let mut eligible = Vec::new();
            for (i, slot) in self.seats.iter().enumerate() {
                if let Some(seat) = slot {
                    amount += seat.invested.min(level).saturating_sub(prev);
                    if seat.invested >= level && seat.live() {
                        eligible.push(i);
                    }
                }
            }
            match pots.last_mut() {
                Some(last) if eligible.is_empty() => last.amount += amount,
                _ => pots.push(Pot { amount, eligible }),
            }
            prev = level;
        }
        pots
    }

    fn resolve(&mut self, now: Instant) {
        let n = self.seats.len();
        let button = self.button.unwrap_or(0);
        let live = self.seats.iter().flatten().filter(|s| s.live()).count();
        self.reveal = live >= 2;

        let mut payouts: BTreeMap<usize, (u64, Option<&'static str>)> = BTreeMap::new();
        for pot in self.build_pots() {
            if pot.eligible.is_empty() {
                continue;
            }
            let (mut winners, hand) = if pot.eligible.len() == 1 {
                (pot.eligible.clone(), None)
            } else {
                let scored: Vec<(usize, HandScore)> = pot
                    .eligible
                    .iter()
                    .map(|&i| {
                        let mut cards = self.seat(i).hole.clone();
                        cards.extend_from_slice(&self.board);
                        (i, best_hand(&cards))
                    })
                    .collect();
                let best = scored.iter().map(|(_, score)| *score).max().expect("eligible seats");
                let winners = scored
                    .iter()
                    .filter(|(_, score)| *score == best)
                    .map(|(i, _)| *i)
                    .collect();
                (winners, Some(best.name()))
            };

            winners.sort_by_key(|&i| (i + n - button - 1) % n);
            let count = winners.len() as u64;
            let share = pot.amount / count;
            let remainder = pot.amount % count;
            for (k, &i) in winners.iter().enumerate() {
                let amount = share + u64::from((k as u64) < remainder);
                self.seat_mut(i).stack += amount;
                let entry = payouts.entry(i).or_insert((0, None));
                entry.0 += amount;
                if hand.is_some() {
                    entry.1 = hand;
                }
            }
        }

        self.awards = payouts
            .into_iter()
            .map(|(seat, (amount, hand))| Award {
                seat,
                amount,
                hand: hand.map(String::from),
            })
            .collect();
        let messages: Vec<String> = self
            .awards
            .iter()
            .map(|award| {
                let name = self.seat_name(award.seat);
                match &award.hand {
                    Some(hand) => format!("{name} wins {} with {hand}", award.amount),
                    None => format!("{name} wins {}", award.amount),
                }
            })
            .collect();
        for message in messages {
            self.push_log(message);
        }

        let reveal = self.reveal;
        for seat in self.seats.iter_mut().flatten() {
            seat.bet = 0;
            seat.invested = 0;
            seat.acted = false;
            seat.all_in = false;
            seat.in_hand = false;
            if seat.folded || !reveal {
                seat.hole.clear();
            }
            seat.folded = false;
        }
        for slot in self.seats.iter_mut() {
            if slot.as_ref().is_some_and(|s| s.leaving) {
                *slot = None;
            }
        }

        self.stage = Stage::Showdown;
        self.to_act = None;
        self.deadline = None;
        self.current_bet = 0;
        self.schedule_next_hand(now);
    }
}

fn random_look() -> Look {
    use rand::Rng;
    let mut rng = rand::rng();
    Look {
        character: rng.random_range(0..Look::CHARACTER_COUNT),
        tone: rng.random_range(0..Look::MIN_SWATCHES),
        hair: rng.random_range(0..Look::MIN_SWATCHES),
        accent: rng.random_range(0..Look::ACCENT_COUNT),
        hat: rng.random_range(0..Look::HAT_COUNT),
        glasses: rng.random_bool(0.3),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table(max_seats: usize) -> Table {
        Table::new(
            "TEST".into(),
            TableConfig {
                name: "test".into(),
                small_blind: 5,
                big_blind: 10,
                buy_in: 1000,
                max_seats,
                private: false,
            },
        )
    }

    fn sit_all(t: &mut Table, n: usize, now: Instant) {
        for i in 0..n {
            t.sit(&format!("p{i}"), &format!("P{i}"), Look::default(), i, now).unwrap();
        }
    }

    fn total_chips(t: &Table) -> u64 {
        t.seats.iter().flatten().map(|s| s.stack + s.invested).sum()
    }

    #[test]
    fn heads_up_blinds_and_preflop_order() {
        let now = Instant::now();
        let mut t = table(6);
        sit_all(&mut t, 2, now);
        t.tick(now + NEXT_HAND_DELAY);
        assert_eq!(t.stage, Stage::Preflop);
        let button = t.button.unwrap();
        assert_eq!(t.to_act, Some(button), "button acts first heads-up preflop");
        assert_eq!(t.current_bet, 10);
    }

    #[test]
    fn fold_to_single_player_awards_pot() {
        let now = Instant::now();
        let mut t = table(6);
        sit_all(&mut t, 3, now);
        let start = total_chips(&t);
        t.tick(now + NEXT_HAND_DELAY);
        let first = t.to_act.unwrap();
        let id = t.seat(first).player_id.clone();
        t.act(&id, Action::Fold, now).unwrap();
        let second = t.to_act.unwrap();
        let id = t.seat(second).player_id.clone();
        t.act(&id, Action::Fold, now).unwrap();
        assert_eq!(t.stage, Stage::Showdown);
        assert_eq!(total_chips(&t), start);
        assert_eq!(t.awards.len(), 1);
        assert_eq!(t.awards[0].amount, 15);
    }

    #[test]
    fn all_in_runs_out_to_showdown_and_conserves_chips() {
        let now = Instant::now();
        let mut t = table(6);
        sit_all(&mut t, 3, now);
        let start = total_chips(&t);
        t.tick(now + NEXT_HAND_DELAY);
        for _ in 0..3 {
            let idx = t.to_act.unwrap();
            let id = t.seat(idx).player_id.clone();
            t.act(&id, Action::AllIn, now).unwrap();
        }
        assert_eq!(t.stage, Stage::Showdown);
        assert_eq!(t.board.len(), 5);
        assert_eq!(total_chips(&t), start);
    }

    #[test]
    fn short_all_in_creates_side_pot() {
        let now = Instant::now();
        let mut t = table(6);
        sit_all(&mut t, 3, now);
        t.seat_mut(0).stack = 100;
        let start = total_chips(&t);
        t.tick(now + NEXT_HAND_DELAY);
        for _ in 0..3 {
            let idx = t.to_act.unwrap();
            let id = t.seat(idx).player_id.clone();
            t.act(&id, Action::AllIn, now).unwrap();
        }
        assert_eq!(total_chips(&t), start);
        assert_eq!(t.stage, Stage::Showdown);
    }

    #[test]
    fn min_raise_is_enforced() {
        let now = Instant::now();
        let mut t = table(6);
        sit_all(&mut t, 3, now);
        t.tick(now + NEXT_HAND_DELAY);
        let idx = t.to_act.unwrap();
        let id = t.seat(idx).player_id.clone();
        assert!(t.act(&id, Action::Raise { amount: 15 }, now).is_err());
        assert!(t.act(&id, Action::Raise { amount: 20 }, now).is_ok());
    }

    #[test]
    fn side_pots_split_by_contribution() {
        let now = Instant::now();
        let mut t = table(6);
        sit_all(&mut t, 3, now);
        for (i, invested) in [100u64, 300, 300].into_iter().enumerate() {
            let seat = t.seat_mut(i);
            seat.invested = invested;
            seat.in_hand = true;
        }
        let pots = t.build_pots();
        assert_eq!(pots.len(), 2);
        assert_eq!(pots[0].amount, 300);
        assert_eq!(pots[0].eligible, vec![0, 1, 2]);
        assert_eq!(pots[1].amount, 400);
        assert_eq!(pots[1].eligible, vec![1, 2]);
    }

    #[test]
    fn bots_play_hands_to_completion() {
        let mut now = Instant::now();
        let mut t = table(6);
        for _ in 0..4 {
            t.add_bot(now).unwrap();
        }
        let start = total_chips(&t);
        let mut showdowns = 0;
        for _ in 0..4000 {
            now += Duration::from_millis(250);
            t.tick(now);
            if t.stage == Stage::Showdown {
                showdowns += 1;
            }
            assert_eq!(total_chips(&t), start, "chips must be conserved");
            if showdowns >= 5 {
                break;
            }
        }
        assert!(showdowns >= 5, "bots should finish several hands");
    }

    #[test]
    fn timeout_folds_when_facing_bet() {
        let now = Instant::now();
        let mut t = table(6);
        sit_all(&mut t, 3, now);
        t.tick(now + NEXT_HAND_DELAY);
        let idx = t.to_act.unwrap();
        t.tick(now + NEXT_HAND_DELAY + ACTION_TIMEOUT + Duration::from_secs(1));
        assert!(t.seat(idx).folded);
    }
}
