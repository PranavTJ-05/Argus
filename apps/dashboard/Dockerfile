FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG NEXT_PUBLIC_API_URL=https://argus-api.onrender.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @argus/dashboard... build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@argus/dashboard", "start"]
