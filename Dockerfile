FROM node:22-alpine

ENV PNPM_HOME=/usr/local/share/pnpm \
    PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

WORKDIR /app

# Install deps first (no lockfile here; service-level install is fine)
COPY package.json ./
RUN pnpm install --prefer-offline --frozen-lockfile=false

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Ensure runtime dir exists for saved voices
RUN mkdir -p /app/voices

CMD ["pnpm", "start"]


