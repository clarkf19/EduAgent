"""
test_predictor.py
-----------------
Tests RandomForest training and predictions.
"""

import sys
import os

# Append app dir to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.predictor import PerformancePredictor

def test_engine():
    print("Initializing predictor...")
    predictor = PerformancePredictor()
    
    print("Training predictor model...")
    predictor.train()
    
    print(f"Model trained? {predictor.trained}")
    assert predictor.trained is True
    
    print("Testing predictions...")
    # Student with high scores and high study hours
    score, mastery = predictor.predict_performance(92.0, 35.0, 8, 0.85)
    print(f"High profile: Score: {score}%, Mastery Prob: {mastery}")
    assert 80 <= score <= 100
    assert 0.7 <= mastery <= 1.0

    # Student with low scores and minimal study hours
    score_low, mastery_low = predictor.predict_performance(45.0, 3.0, 1, 0.15)
    print(f"Low profile: Score: {score_low}%, Mastery Prob: {mastery_low}")
    assert score_low < score
    assert mastery_low < mastery

    print("Predictor validation checks passed!")

if __name__ == "__main__":
    test_engine()
