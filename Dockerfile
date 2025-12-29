# Stage 1: Build the React app
FROM node:20-alpine AS build
WORKDIR /app

# Accept the API Key as a build argument
ARG GEMINI_API_KEY

COPY package*.json ./
RUN npm install

COPY . .

# Write the API Key to .env.local for Vite to find during build
RUN echo "VITE_GEMINI_API_KEY=$GEMINI_API_KEY" > .env.local

RUN npm run build

# Stage 2: Serve the app with Nginx
FROM nginx:alpine
# Copy our custom config
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy the built files from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
# Run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
