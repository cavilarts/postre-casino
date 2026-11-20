use super::card::Card;

/// Packed hand strength: category in the high bits, then up to five 4-bit
/// tiebreak ranks. Higher is stronger, so scores compare with plain integers.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct HandScore(u32);

const NAMES: [&str; 9] = [
    "High Card",
    "One Pair",
    "Two Pair",
    "Three of a Kind",
    "Straight",
    "Flush",
    "Full House",
    "Four of a Kind",
    "Straight Flush",
];

impl HandScore {
    /// Hand category from 0 (high card) to 8 (straight flush).
    pub fn category(self) -> u32 {
        self.0 >> 20
    }

    /// Plain-language description, e.g. "Pair of Kings" or "Full house, Aces over Kings".
    pub fn describe(self) -> String {
        let k = |i: usize| ((self.0 >> (16 - 4 * i)) & 0xF) as u8;
        match self.category() {
            0 => format!("{} high", rank_singular(k(0))),
            1 => format!("Pair of {}", rank_plural(k(0))),
            2 => format!("Two pair, {} and {}", rank_plural(k(0)), rank_plural(k(1))),
            3 => format!("Three {}", rank_plural(k(0))),
            4 => format!("Straight, {} high", rank_singular(k(0))),
            5 => format!("Flush, {} high", rank_singular(k(0))),
            6 => format!("Full house, {} over {}", rank_plural(k(0)), rank_plural(k(1))),
            7 => format!("Four {}", rank_plural(k(0))),
            _ => format!("Straight flush, {} high", rank_singular(k(0))),
        }
    }

    pub fn name(self) -> &'static str {
        NAMES[(self.0 >> 20) as usize]
    }
}

fn rank_singular(rank: u8) -> &'static str {
    match rank {
        14 => "Ace",
        13 => "King",
        12 => "Queen",
        11 => "Jack",
        10 => "Ten",
        9 => "Nine",
        8 => "Eight",
        7 => "Seven",
        6 => "Six",
        5 => "Five",
        4 => "Four",
        3 => "Three",
        _ => "Two",
    }
}

fn rank_plural(rank: u8) -> String {
    match rank {
        14 => "Aces".into(),
        13 => "Kings".into(),
        12 => "Queens".into(),
        11 => "Jacks".into(),
        6 => "Sixes".into(),
        _ => format!("{}s", rank_singular(rank)),
    }
}

/// Starting-hand name for two hole cards, e.g. "Pocket Aces" or "Ace King suited".
pub fn starting_hand(a: Card, b: Card) -> String {
    if a.rank == b.rank {
        return format!("Pocket {}", rank_plural(a.rank));
    }
    let (hi, lo) = if a.rank > b.rank { (a, b) } else { (b, a) };
    let suited = if a.suit == b.suit { "suited" } else { "offsuit" };
    format!("{} {} {}", rank_singular(hi.rank), rank_singular(lo.rank), suited)
}

/// Best five-card hand out of 5 to 7 cards.
pub fn best_hand(cards: &[Card]) -> HandScore {
    let n = cards.len();
    debug_assert!((5..=7).contains(&n));
    let mut best = HandScore(0);
    for mask in 0u32..(1 << n) {
        if mask.count_ones() != 5 {
            continue;
        }
        let mut five = [cards[0]; 5];
        let mut k = 0;
        for (i, card) in cards.iter().enumerate() {
            if mask & (1 << i) != 0 {
                five[k] = *card;
                k += 1;
            }
        }
        best = best.max(eval_five(&five));
    }
    best
}

fn eval_five(cards: &[Card; 5]) -> HandScore {
    let mut ranks = [0u8; 5];
    for (i, card) in cards.iter().enumerate() {
        ranks[i] = card.rank;
    }
    ranks.sort_unstable_by(|a, b| b.cmp(a));

    let flush = cards.iter().all(|c| c.suit == cards[0].suit);
    let distinct = ranks.windows(2).all(|w| w[0] != w[1]);
    let straight_high = if distinct && ranks[0] - ranks[4] == 4 {
        Some(ranks[0])
    } else if distinct && ranks == [14, 5, 4, 3, 2] {
        Some(5)
    } else {
        None
    };

    // (count, rank) groups, most frequent first, then highest rank first.
    let mut groups: Vec<(u8, u8)> = Vec::with_capacity(5);
    for &rank in &ranks {
        match groups.iter_mut().find(|g| g.1 == rank) {
            Some(group) => group.0 += 1,
            None => groups.push((1, rank)),
        }
    }
    groups.sort_unstable_by(|a, b| b.cmp(a));
    let counts: Vec<u8> = groups.iter().map(|g| g.0).collect();
    let by_group: Vec<u8> = groups.iter().map(|g| g.1).collect();

    let (category, order): (u32, Vec<u8>) = match (straight_high, flush, counts.as_slice()) {
        (Some(high), true, _) => (8, vec![high]),
        (_, _, [4, ..]) => (7, by_group),
        (_, _, [3, 2]) => (6, by_group),
        (_, true, _) => (5, ranks.to_vec()),
        (Some(high), false, _) => (4, vec![high]),
        (_, _, [3, ..]) => (3, by_group),
        (_, _, [2, 2, ..]) => (2, by_group),
        (_, _, [2, ..]) => (1, by_group),
        _ => (0, ranks.to_vec()),
    };

    let mut score = category << 20;
    for (i, rank) in order.iter().take(5).enumerate() {
        score |= (*rank as u32) << (16 - 4 * i);
    }
    HandScore(score)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::poker::card::Suit;

    fn cards(codes: &str) -> Vec<Card> {
        codes
            .split_whitespace()
            .map(|code| {
                let bytes = code.as_bytes();
                let rank = match bytes[0] {
                    b'T' => 10,
                    b'J' => 11,
                    b'Q' => 12,
                    b'K' => 13,
                    b'A' => 14,
                    d => d - b'0',
                };
                let suit = match bytes[1] {
                    b'c' => Suit::Clubs,
                    b'd' => Suit::Diamonds,
                    b'h' => Suit::Hearts,
                    _ => Suit::Spades,
                };
                Card { rank, suit }
            })
            .collect()
    }

    fn name(codes: &str) -> &'static str {
        best_hand(&cards(codes)).name()
    }

    #[test]
    fn categories() {
        assert_eq!(name("Ah Kh Qh Jh Th 2c 3d"), "Straight Flush");
        assert_eq!(name("9s 9h 9d 9c 2h 3d 4s"), "Four of a Kind");
        assert_eq!(name("Ks Kh Kd 2c 2h 7d 9s"), "Full House");
        assert_eq!(name("2s 7s 9s Js Ks 3d 4c"), "Flush");
        assert_eq!(name("5s 6h 7d 8c 9s Kd 2c"), "Straight");
        assert_eq!(name("Ah 2d 3c 4s 5h Kd Qc"), "Straight");
        assert_eq!(name("Qs Qh Qd 4c 8h 2d 9s"), "Three of a Kind");
        assert_eq!(name("Qs Qh 4d 4c 8h 2d 9s"), "Two Pair");
        assert_eq!(name("Qs Qh 4d 5c 8h 2d 9s"), "One Pair");
        assert_eq!(name("Qs Jh 4d 5c 8h 2d 9s"), "High Card");
    }

    #[test]
    fn describes_made_hands() {
        assert_eq!(best_hand(&cards("Kh Kd 2c 5s 9h 3d 7c")).describe(), "Pair of Kings");
        assert_eq!(best_hand(&cards("Qs Qh 4d 4c 8h 2d 9s")).describe(), "Two pair, Queens and Fours");
        assert_eq!(best_hand(&cards("2h 5h 9h Jh Kh 3c 4d")).describe(), "Flush, King high");
    }

    #[test]
    fn names_starting_hands() {
        use crate::poker::card::Suit;
        let card = |rank, suit| Card { rank, suit };
        assert_eq!(starting_hand(card(14, Suit::Spades), card(14, Suit::Hearts)), "Pocket Aces");
        assert_eq!(starting_hand(card(13, Suit::Hearts), card(14, Suit::Hearts)), "Ace King suited");
        assert_eq!(starting_hand(card(14, Suit::Clubs), card(7, Suit::Hearts)), "Ace Seven offsuit");
    }

    #[test]
    fn wheel_is_lowest_straight() {
        let wheel = best_hand(&cards("Ah 2d 3c 4s 5h Kd Qc"));
        let six_high = best_hand(&cards("2h 3d 4c 5s 6h Kd Qc"));
        assert!(six_high > wheel);
    }

    #[test]
    fn kickers_decide_ties() {
        let better = best_hand(&cards("Ah Ad 2c 3d 4s Kc Qh"));
        let worse = best_hand(&cards("Ac Ad 2h 3s 4c Kd Jh"));
        assert!(better > worse);
    }

    #[test]
    fn category_beats_kicker() {
        let flush = best_hand(&cards("2h 5h 9h Jh Kh 3c 4d"));
        let straight = best_hand(&cards("5c 6d 7h 8s 9c Ad Ks"));
        assert!(flush > straight);
    }
}
