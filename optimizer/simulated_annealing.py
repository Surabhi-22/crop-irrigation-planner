"""Simulated Annealing alternative for crop-plan optimization."""

import math
import random


def optimize_crop_plan_sa(
    plots,
    options,
    available_water_m3,
    initial_temperature=1000.0,
    cooling_rate=0.995,
    max_iterations=5000,
    random_seed=42,
):
    """Find a high-profit feasible crop assignment using Simulated Annealing.

    Each plot must receive exactly one eligible crop. Total water use must
    not exceed the available water budget.

    Options require: plot_id, crop, expected_profit_inr, water_required_m3.
    """
    try:
        budget = float(available_water_m3)
        temperature = float(initial_temperature)
        cooling = float(cooling_rate)
        iterations = int(max_iterations)

        if not math.isfinite(budget) or budget < 0:
            raise ValueError("Water budget must be finite and non-negative.")
        if not math.isfinite(temperature) or temperature <= 0:
            raise ValueError("Initial temperature must be positive and finite.")
        if not math.isfinite(cooling) or not 0 < cooling < 1:
            raise ValueError("Cooling rate must be greater than 0 and less than 1.")
        if iterations < 1:
            raise ValueError("max_iterations must be at least 1.")
        if not plots:
            raise ValueError("At least one plot is required.")

        plot_ids = [p["plot_id"] for p in plots]
        if len(plot_ids) != len(set(plot_ids)):
            raise ValueError("Plot IDs must be unique.")

        candidates = {pid: [] for pid in plot_ids}

        for option in options:
            pid = option["plot_id"]
            if pid not in candidates:
                continue

            profit = float(option["expected_profit_inr"])
            water = float(option["water_required_m3"])

            if not math.isfinite(profit) or not math.isfinite(water):
                raise ValueError("Profit and water values must be finite.")
            if water < 0:
                raise ValueError("Water requirements cannot be negative.")

            candidates[pid].append({
                "plot_id": pid,
                "crop": option["crop"],
                "expected_profit_inr": profit,
                "water_required_m3": water,
            })

        for plot in plots:
            pid = plot["plot_id"]
            eligible = set(plot.get("candidates", []))
            candidates[pid] = [
                item for item in candidates[pid]
                if item["crop"] in eligible
            ]
            if not candidates[pid]:
                return {
                    "status": "infeasible",
                    "message": f"No available crop options for plot {pid}.",
                }

        # Start with the lowest-water option for every plot.
        current = {
            pid: min(items, key=lambda item: item["water_required_m3"])
            for pid, items in candidates.items()
        }

        def totals(plan):
            water = sum(x["water_required_m3"] for x in plan.values())
            profit = sum(x["expected_profit_inr"] for x in plan.values())
            return profit, water

        current_profit, current_water = totals(current)

        if current_water > budget:
            return {
                "status": "infeasible",
                "message": "No crop assignment can satisfy the water budget.",
                "minimum_water_required_m3": current_water,
                "available_water_m3": budget,
            }

        rng = random.Random(random_seed)
        best = dict(current)
        best_profit = current_profit
        best_water = current_water

        for _ in range(iterations):
            pid = rng.choice(plot_ids)
            alternatives = [
                item for item in candidates[pid]
                if item["crop"] != current[pid]["crop"]
            ]

            if not alternatives:
                temperature *= cooling
                continue

            replacement = rng.choice(alternatives)
            neighbor = dict(current)
            neighbor[pid] = replacement
            neighbor_profit, neighbor_water = totals(neighbor)

            if neighbor_water <= budget:
                delta = neighbor_profit - current_profit
                accept = delta >= 0 or rng.random() < math.exp(
                    max(-700.0, delta / temperature)
                )

                if accept:
                    current = neighbor
                    current_profit = neighbor_profit
                    current_water = neighbor_water

                    if current_profit > best_profit:
                        best = dict(current)
                        best_profit = current_profit
                        best_water = current_water

            temperature *= cooling

        selected = [best[pid] for pid in plot_ids]

        return {
            "status": "success",
            "selected_crops": selected,
            "total_expected_profit_inr": best_profit,
            "total_water_required_m3": best_water,
            "available_water_m3": budget,
            "remaining_water_m3": budget - best_water,
            "plots_planned": len(selected),
            "optimization_method": "Simulated Annealing",
            "note": (
                "Heuristic result; global optimality is not guaranteed. "
                "Estimated profit is not guaranteed actual farm income."
            ),
        }

    except (KeyError, TypeError, ValueError, OverflowError) as exc:
        return {
            "status": "invalid_input",
            "message": str(exc),
        }
