"""
predictor.py
------------
Machine Learning Performance Prediction Engine.

Generates synthetic student study logs, trains a Random Forest model
on startup, and predicts expected exam scores and mastery confidence
based on user study behaviors.
"""

import logging
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from typing import Tuple

logger = logging.getLogger(__name__)


class PerformancePredictor:
    def __init__(self):
        self.score_model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.mastery_model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.trained = False

    def generate_synthetic_data(self, n_samples: int = 1000) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Generate realistic synthetic study profiles for training.
        Features:
          0: quiz_average (0 to 100)
          1: study_hours (0 to 50)
          2: attempts_count (0 to 15)
          3: completion_rate (0.0 to 1.0)
        """
        np.random.seed(42)
        
        # Features
        quiz_avg = np.random.uniform(40, 100, n_samples)
        study_hours = np.random.uniform(2, 45, n_samples)
        quiz_count = np.random.randint(1, 12, n_samples)
        completion = np.random.uniform(0.1, 1.0, n_samples)

        X = np.column_stack((quiz_avg, study_hours, quiz_count, completion))

        # Expected score target (0 to 100)
        # Linear correlation with noise
        noise = np.random.normal(0, 4, n_samples)
        exam_score = (
            0.50 * quiz_avg +
            0.25 * (study_hours * 2.2) +
            0.15 * (completion * 100) +
            0.10 * (np.minimum(quiz_count, 8) * 12.5) +
            noise
        )
        # Keep realistic bounds
        y_score = np.clip(exam_score, 35, 98)

        # Mastery Probability target (0.0 to 1.0)
        # Higher score -> higher probability of mastering the topics
        # Logistic sigmoid curve with some variance
        mastery_noise = np.random.uniform(-0.08, 0.08, n_samples)
        mastery_prob = 1.0 / (1.0 + np.exp(-0.08 * (y_score - 70))) + mastery_noise
        y_mastery = np.clip(mastery_prob, 0.0, 1.0)

        return X, y_score, y_mastery

    def train(self):
        """Train the random forest models on the synthetic logs."""
        try:
            logger.info("Generating synthetic training logs for performance predictor...")
            X, y_score, y_mastery = self.generate_synthetic_data(1000)
            
            logger.info("Fitting Random Forest models...")
            self.score_model.fit(X, y_score)
            self.mastery_model.fit(X, y_mastery)
            
            self.trained = True
            logger.info("Performance prediction model trained successfully.")
        except Exception as e:
            logger.error(f"Failed to train prediction model: {e}")
            self.trained = False

    def predict_performance(
        self,
        quiz_average: float,
        study_hours: float,
        attempts_count: int,
        completion_rate: float
    ) -> Tuple[float, float]:
        """
        Predict expected exam score and mastery probability.
        If model is not trained, returns a fallback heuristic calculation.
        """
        if not self.trained:
            # Fallback heuristic
            score_est = 0.5 * quiz_average + 0.3 * (study_hours * 2.0) + 0.2 * (completion_rate * 100)
            score_est = min(max(score_est, 40.0), 98.0)
            mastery_est = 1.0 / (1.0 + np.exp(-0.08 * (score_est - 70)))
            return round(score_est, 1), round(mastery_est, 2)

        input_features = np.array([[quiz_average, study_hours, attempts_count, completion_rate]])
        
        pred_score = self.score_model.predict(input_features)[0]
        pred_mastery = self.mastery_model.predict(input_features)[0]

        return round(float(pred_score), 1), round(float(pred_mastery), 2)
