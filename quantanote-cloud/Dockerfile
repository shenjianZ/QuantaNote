# ===== Stage 1: Build =====
FROM rust:1.88-bookworm AS builder

WORKDIR /app

# 先复制依赖清单，利用 Docker 层缓存
COPY Cargo.toml Cargo.lock ./

# 创建空 src 以预编译依赖
RUN mkdir src && echo 'fn main() {}' > src/main.rs
RUN cargo build --release && rm -rf src

# 复制完整源码
COPY src/ src/
COPY config/ config/

# 触发完整构建（利用缓存的依赖层）
RUN touch src/main.rs && cargo build --release

# ===== Stage 2: Runtime =====
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 从构建阶段复制二进制
COPY --from=builder /app/target/release/quantanote-cloud /app/quantanote-cloud

# 创建数据和存储目录
RUN mkdir -p /app/config /app/data /app/sync_data

# 配置文件通过 volume 挂载，不内置敏感配置
VOLUME ["/app/config", "/app/data", "/app/sync_data"]

EXPOSE 3000

ENV ENV=production

ENTRYPOINT ["/app/quantanote-cloud"]
CMD ["-e", "production"]
