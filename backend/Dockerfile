# In: backend/Dockerfile

FROM python:3.10-slim

# Install system dependencies
# - build-essential: for compiling python packages
# - libpq-dev: for postgres drivers
# - libpango*, libcairo2, libgdk-pixbuf*: REQUIRED for WeasyPrint PDF generation
# ✅ FIXED: Changed 'libgdk-pixbuf2.0-0' to 'libgdk-pixbuf-2.0-0' for newer Debian
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# ✅ ROBUST INSTALL: Increased timeout to 1000s and retries to 10 to handle slow/unstable internet
RUN pip install --default-timeout=1000 --retries 10 -r requirements.txt

# Copy the rest of the backend application code
COPY . .

# Run the uvicorn server for FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]