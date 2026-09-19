#!/usr/bin/env python3
"""Run simple random-cut simulations of the two-player stone game."""

from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path


DEFAULT_ROUNDS = 15
DEFAULT_RED_STONES = 100
DEFAULT_GAMES = 100
DEFAULT_SEED = 42
DEFAULT_OUTPUT = Path("simulation_results.csv")
DEFAULT_BALANCE_OUTPUT = Path("balance_results.csv")


def random_cut_allocation(total_stones: int, rounds: int, rng: random.Random) -> list[int]:
    """Split stones using sorted random cut points, exactly as proposed."""
    cuts = sorted(rng.randint(0, total_stones) for _ in range(rounds - 1))
    boundaries = [0, *cuts, total_stones]
    return [right - left for left, right in zip(boundaries, boundaries[1:])]


def play_game(red_piles: list[int], blue_piles: list[int]) -> tuple[int, int, int]:
    """Return red score, blue score, and the number of tied rounds."""
    red_score = 0
    blue_score = 0
    tied_rounds = 0

    for red_stones, blue_stones in zip(red_piles, blue_piles):
        if red_stones >= blue_stones:
            red_score += 1
            if red_stones == blue_stones:
                tied_rounds += 1
        else:
            blue_score += 1

    return red_score, blue_score, tied_rounds


def run_simulation(
    rounds: int,
    red_stones: int,
    games: int,
    seed: int,
    output_path: Path,
) -> tuple[int, int]:
    if rounds <= 0 or rounds % 2 == 0:
        raise ValueError("R must be a positive odd number")
    if red_stones < 0:
        raise ValueError("S must be nonnegative")
    if games <= 0:
        raise ValueError("The number of games must be positive")

    blue_bonus = (rounds - 1) // 2
    blue_stones = red_stones + blue_bonus
    rng = random.Random(seed)
    red_wins = 0
    blue_wins = 0

    fieldnames = [
        "game",
        "red_total_stones",
        "blue_total_stones",
        "red_score",
        "blue_score",
        "tied_rounds_won_by_red",
        "winner",
    ]
    fieldnames.extend(f"red_round_{round_number}" for round_number in range(1, rounds + 1))
    fieldnames.extend(f"blue_round_{round_number}" for round_number in range(1, rounds + 1))

    with output_path.open("w", newline="", encoding="utf-8") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=fieldnames)
        writer.writeheader()

        for game_number in range(1, games + 1):
            red_piles = random_cut_allocation(red_stones, rounds, rng)
            blue_piles = random_cut_allocation(blue_stones, rounds, rng)
            red_score, blue_score, tied_rounds = play_game(red_piles, blue_piles)

            if red_score > blue_score:
                winner = "red"
                red_wins += 1
            else:
                winner = "blue"
                blue_wins += 1

            row = {
                "game": game_number,
                "red_total_stones": red_stones,
                "blue_total_stones": blue_stones,
                "red_score": red_score,
                "blue_score": blue_score,
                "tied_rounds_won_by_red": tied_rounds,
                "winner": winner,
            }
            row.update(
                {f"red_round_{round_number}": stones for round_number, stones in enumerate(red_piles, 1)}
            )
            row.update(
                {f"blue_round_{round_number}": stones for round_number, stones in enumerate(blue_piles, 1)}
            )
            writer.writerow(row)

    return red_wins, blue_wins


def simulate_win_counts(
    rounds: int,
    red_stones: int,
    blue_stones: int,
    games: int,
    seed: int,
) -> tuple[int, int]:
    """Simulate games without writing per-game results."""
    rng = random.Random(seed)
    red_wins = 0

    for _ in range(games):
        red_piles = random_cut_allocation(red_stones, rounds, rng)
        blue_piles = random_cut_allocation(blue_stones, rounds, rng)
        red_score, blue_score, _ = play_game(red_piles, blue_piles)
        if red_score > blue_score:
            red_wins += 1

    return red_wins, games - red_wins


def simulate_balance_grid(
    rounds: int,
    red_totals: list[int],
    games: int,
    seed: int,
) -> list[tuple[int, int, int, int]]:
    """Simulate every allowed Blue total for each Red total."""
    results = []

    for red_stones in red_totals:
        for blue_stones in range(red_stones, red_stones + rounds + 1):
            candidate_seed = seed + red_stones * 1_000 + blue_stones
            red_wins, blue_wins = simulate_win_counts(
                rounds=rounds,
                red_stones=red_stones,
                blue_stones=blue_stones,
                games=games,
                seed=candidate_seed,
            )
            results.append((red_stones, blue_stones, red_wins, blue_wins))

    return results


def write_balance_results(
    results: list[tuple[int, int, int, int]], games: int, output_path: Path
) -> None:
    """Write aggregate balance results without per-game data."""
    with output_path.open("w", newline="", encoding="utf-8") as output_file:
        writer = csv.writer(output_file)
        writer.writerow(["red stones", "blue stones", "red win rate", "blue win rate"])
        for red_stones, blue_stones, red_wins, blue_wins in results:
            writer.writerow(
                [
                    red_stones,
                    blue_stones,
                    f"{red_wins / games:.2%}",
                    f"{blue_wins / games:.2%}",
                ]
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rounds", type=int, default=DEFAULT_ROUNDS)
    parser.add_argument("--red-stones", type=int, default=DEFAULT_RED_STONES)
    parser.add_argument("--games", type=int, default=DEFAULT_GAMES)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--balance-output", type=Path, default=DEFAULT_BALANCE_OUTPUT)
    parser.add_argument(
        "--find-balanced",
        action="store_true",
        help="Search Blue totals for Red totals 100, 200, 500, and 1000 without writing CSV",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.find_balanced:
        results = simulate_balance_grid(
            rounds=args.rounds,
            red_totals=[100, 200, 500, 1_000],
            games=args.games,
            seed=args.seed,
        )
        write_balance_results(results, args.games, args.balance_output)

        for red_stones in [100, 200, 500, 1_000]:
            candidates = [result for result in results if result[0] == red_stones]
            _, blue_stones, red_wins, blue_wins = min(
                candidates, key=lambda result: abs(result[2] - result[3])
            )
            print(
                f"Red stones: {red_stones:4d} | Blue stones: {blue_stones:4d} | "
                f"Red: {red_wins / args.games:6.2%} | Blue: {blue_wins / args.games:6.2%}"
            )
        print(f"Details: {args.balance_output}")
        return

    red_wins, blue_wins = run_simulation(
        rounds=args.rounds,
        red_stones=args.red_stones,
        games=args.games,
        seed=args.seed,
        output_path=args.output,
    )

    print(f"Red wins:  {red_wins}")
    print(f"Blue wins: {blue_wins}")
    print(f"Details:   {args.output}")


if __name__ == "__main__":
    main()
