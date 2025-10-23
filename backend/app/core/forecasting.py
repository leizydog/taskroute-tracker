# In backend/app/core/forecasting.py

import joblib
import pandas as pd
import json
from pathlib import Path

# --- Load Model Assets on Startup ---
# This makes sure the model is loaded only once, not on every request
BASE_DIR = Path(__file__).resolve().parent.parent 
MODEL_DIR = BASE_DIR / "ml_model"

try:
    model = joblib.load(MODEL_DIR / "task_duration_model.joblib")
    prophet_features_df = pd.read_csv(MODEL_DIR / "prophet_features.csv", parse_dates=['Date'])
    model_columns = json.load(open(MODEL_DIR / "model_columns.json"))
    print("Forecasting model loaded successfully.")
except Exception as e:
    print(f"Error loading model assets: {e}")
    model = None

def predict_duration(task_data: dict) -> dict:
    """
    Predicts the task duration based on input data.
    'task_data' is a dictionary with keys like 'City', 'Conditions', 'Method', etc.
    """
    if model is None:
        return {"error": "Model is not loaded."}

    # 1. Convert the incoming data into a DataFrame
    new_task_df = pd.DataFrame([task_data])
    new_task_df['Date'] = pd.to_datetime(new_task_df['Date'])
    new_task_df['StartTime'] = pd.to_datetime(new_task_df['StartTime'])

    # 2. --- Engineer the SAME features as in Colab ---
    new_task_df['start_hour'] = new_task_df['StartTime'].dt.hour
    new_task_df['dayofweek'] = new_task_df['StartTime'].dt.dayofweek
    new_task_df['month'] = new_task_df['StartTime'].dt.month
    
    # Add any other simple features from your model
    new_task_df['Success_binary'] = 1 # Assume we predict a successful task
    new_task_df['Reliability_pct'] = task_data.get('Reliability_pct', 90.0) # Use a default
    new_task_df['Errors'] = 0
    new_task_df['Attempts'] = 1


    # 3. --- Get the Prophet features for that specific date ---
    date_to_forecast = prophet_features_df[prophet_features_df['Date'] == new_task_df['Date'].iloc[0]]
    
    if not date_to_forecast.empty:
        new_task_df['trend'] = date_to_forecast['trend'].values[0]
        new_task_df['weekly'] = date_to_forecast['weekly'].values[0]
    else:
        # If the date is new, use the last known trend
        new_task_df['trend'] = prophet_features_df['trend'].iloc[-1]
        new_task_df['weekly'] = prophet_features_df['weekly'].iloc[-1]

    # 4. --- Create all the one-hot encoded columns ---
    final_features = pd.DataFrame(columns=model_columns)
    final_features = pd.concat([final_features, new_task_df])
    final_features = final_features.fillna(0)

    # Dynamically set the one-hot encoded features
    for col in final_features.columns:
        if col.startswith("City_") and col == f"City_{task_data.get('City')}":
            final_features[col] = 1
        if col.startswith("Conditions_") and col == f"Conditions_{task_data.get('Conditions')}":
            final_features[col] = 1
        if col.startswith("Method_") and col == f"Method_{task_data.get('Method')}":
            final_features[col] = 1
            
    # 5. --- Make the final prediction ---
    final_prediction_features = final_features[model_columns].head(1)
    
    prediction_seconds = model.predict(final_prediction_features)[0]

    # 6. --- Return the result ---
    return {
        "predicted_duration_seconds": round(float(prediction_seconds), 2),
        "predicted_duration_minutes": round(float(prediction_seconds) / 60, 2)
    }