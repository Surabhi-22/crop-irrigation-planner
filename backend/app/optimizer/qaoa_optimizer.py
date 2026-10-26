"""QAOA-based crop planning using Qiskit Optimization."""

import math


def optimize_crop_plan_qaoa(
    plots,
    options,
    available_water_m3,
    reps=1,
    seed=42,
    max_iterations=100,
):
    """Maximize expected profit using QAOA subject to crop and water constraints.

    Each plot must have exactly one eligible crop. Water use must not exceed
    the available budget. A successful result is independently checked.
    """
    try:
        budget = float(available_water_m3)
        reps = int(reps)
        max_iterations = int(max_iterations)

        if not math.isfinite(budget) or budget < 0:
            raise ValueError("Water budget must be finite and non-negative.")
        if not plots:
            raise ValueError("At least one plot is required.")
        if reps < 1 or max_iterations < 1:
            raise ValueError("reps and max_iterations must be positive.")

        plot_ids = [p["plot_id"] for p in plots]
        if len(plot_ids) != len(set(plot_ids)):
            raise ValueError("Plot IDs must be unique.")

        plot_by_id = {p["plot_id"]: p for p in plots}
        candidates = {pid: [] for pid in plot_ids}

        for option in options:
            pid = option["plot_id"]
            if pid not in plot_by_id:
                continue

            crop = option["crop"]
            eligible = plot_by_id[pid].get("candidates", [])
            if crop not in eligible:
                continue

            profit = float(option["expected_profit_inr"])
            water = float(option["water_required_m3"])

            if not math.isfinite(profit):
                raise ValueError("Profit values must be finite.")
            if not math.isfinite(water) or water < 0:
                raise ValueError(
                    "Water requirements must be finite and non-negative."
                )

            if any(item["crop"] == crop for item in candidates[pid]):
                raise ValueError(
                    f"Duplicate option for plot {pid}, crop {crop}."
                )

            candidates[pid].append({
                "plot_id": pid,
                "crop": crop,
                "expected_profit_inr": profit,
                "water_required_m3": water,
            })

        for pid in plot_ids:
            if not candidates[pid]:
                return {
                    "status": "infeasible",
                    "message": f"No eligible options are available for plot {pid}.",
                }

        minimum_water = sum(
            min(item["water_required_m3"] for item in candidates[pid])
            for pid in plot_ids
        )
        if minimum_water > budget + 1e-9:
            return {
                "status": "infeasible",
                "message": "Minimum possible water use exceeds the budget.",
                "minimum_water_required_m3": minimum_water,
                "available_water_m3": budget,
            }

    except (KeyError, TypeError, ValueError, OverflowError) as exc:
        return {"status": "invalid_input", "message": str(exc)}

    try:
        from qiskit.primitives import StatevectorSampler
        from qiskit_algorithms import QAOA
        from qiskit_algorithms.optimizers import COBYLA
        from qiskit_optimization import QuadraticProgram
        from qiskit_optimization.algorithms import MinimumEigenOptimizer
    except ImportError as exc:
        return {
            "status": "dependency_unavailable",
            "message": f"QAOA dependencies are missing: {exc}",
        }

    try:
        problem = QuadraticProgram("crop_irrigation_planning")
        variable_data = []
        variable_names_by_plot = {pid: [] for pid in plot_ids}
        water_coefficients = {}

        for plot_index, pid in enumerate(plot_ids):
            for crop_index, item in enumerate(candidates[pid]):
                name = f"x_{plot_index}_{crop_index}"
                problem.binary_var(name=name)
                variable_data.append((name, item))
                variable_names_by_plot[pid].append(name)
                water_coefficients[name] = item["water_required_m3"]

        # Maximize total expected profit.
        problem.maximize(
            linear={
                name: item["expected_profit_inr"]
                for name, item in variable_data
            }
        )

        # Exactly one crop must be selected for each plot.
        for plot_index, pid in enumerate(plot_ids):
            problem.linear_constraint(
                linear={name: 1 for name in variable_names_by_plot[pid]},
                sense="==",
                rhs=1,
                name=f"one_crop_for_plot_{plot_index}",
            )

        # Keep the QAOA model compact by omitting the water inequality.
        # Water feasibility is checked independently after solving.
        # This avoids extra binary slack variables, but QAOA may return
        # an assignment that violates the water budget.

        sampler = StatevectorSampler(default_shots=32, seed=seed)
        qaoa = QAOA(
            sampler=sampler,
            optimizer=COBYLA(maxiter=max_iterations),
            reps=reps,
        )
        solver = MinimumEigenOptimizer(qaoa)
        result = solver.solve(problem)

        if result.x is None:
            return {
                "status": "no_solution",
                "message": "QAOA did not return a candidate assignment.",
            }

        selected = []
        for name, item in variable_data:
            if result.x[problem.variables_index[name]] > 0.5:
                selected.append(item)

        selected_by_plot = {item["plot_id"]: item for item in selected}

        # Do not report success for an assignment that violates constraints.
        if set(selected_by_plot) != set(plot_ids) or len(selected) != len(plot_ids):
            return {
                "status": "no_feasible_solution",
                "message": (
                    "QAOA returned an assignment that did not select exactly "
                    "one crop for every plot."
                ),
            }

        total_water = sum(item["water_required_m3"] for item in selected)
        total_profit = sum(item["expected_profit_inr"] for item in selected)

        if total_water > budget + 1e-6:
            return {
                "status": "no_feasible_solution",
                "message": "QAOA result exceeded the water budget.",
                "total_water_required_m3": total_water,
                "available_water_m3": budget,
            }

        return {
            "status": "success",
            "selected_crops": selected,
            "total_expected_profit_inr": total_profit,
            "total_water_required_m3": total_water,
            "available_water_m3": budget,
            "remaining_water_m3": max(0.0, budget - total_water),
            "plots_planned": len(selected),
            "optimization_method": "QAOA (Qiskit)",
            "qaoa_reps": reps,
            "note": (
                "QAOA is a heuristic; global optimality is not guaranteed. "
                "Estimated profit is not guaranteed actual farm income."
            ),
        }

    except (ValueError, RuntimeError, TypeError) as exc:
        return {
            "status": "optimization_error",
            "message": str(exc),
        }

