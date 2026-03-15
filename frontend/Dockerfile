FROM node:20-alpine

WORKDIR /app

# 1. Copy package files first
COPY package.json package-lock.json* ./

# 2. Install Dependencies
# We explicitly install the specific Tailwind version here to override any defaults
RUN npm install && \
    npm install -D tailwindcss@3.4.1 postcss autoprefixer recharts lucide-react clsx tailwind-merge

# 3. Copy source code
COPY . .

# 4. Initialize Tailwind (Only if config doesn't exist)
# This prevents overwriting your custom config if you mounted a volume
RUN npx tailwindcss init -p || true

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]