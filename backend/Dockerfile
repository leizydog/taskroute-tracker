# In: backend/Dockerfile

FROM python:3.10-slim

# --- THIS IS THE FIX ---
# Install build-essential, which contains the C/C++ compilers
RUN apt-get update && apt-get install -y build-essential
# --- END OF FIX ---

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# This will now work, but will be slow the first time
RUN pip install -r requirements.txt

# Copy the rest of the backend application code
COPY . .

# Run the uvicorn server for FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]