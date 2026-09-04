import unittest

from app.contracts import ForecastRunRequest
from app.engine import run_forecast


class ForecastServiceTests(unittest.TestCase):
    def test_exponential_smoothing_returns_horizon_rows(self):
        rows = [{"item_id": "ITEM001", "period": "2026-01-01", "quantity": 10}, {"item_id": "ITEM001", "period": "2026-02-01", "quantity": 12}]
        result = run_forecast("EXPONENTIAL_SMOOTHING", rows, 2, {"alpha": 0.2})
        self.assertEqual(len(result), 2)
        self.assertEqual(result.iloc[0]["item_id"], "ITEM001")

    def test_request_rejects_test_actual(self):
        with self.assertRaises(ValueError):
            ForecastRunRequest.model_validate({"run_id": "r", "model_id": "CROSTON", "model_version": "v", "horizon": 1, "train_rows": [{"item_id": "i", "period": "2026-01-01", "quantity": 1}], "actual_rows": []})


if __name__ == "__main__":
    unittest.main()