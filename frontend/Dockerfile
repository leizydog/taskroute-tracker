# In: frontend/Dockerfile

# Use an official Node.js runtime
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json ./
COPY package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app's source code
COPY . .

# Expose port 3000 (for the React dev server)
EXPOSE 3000

# Run the app
CMD ["npm", "start"]