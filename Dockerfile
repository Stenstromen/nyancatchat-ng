FROM docker.io/library/rust:1.87-alpine as builder
RUN apk add --no-cache musl-dev openssl-dev openssl-libs-static pkgconf git libpq-dev
ENV SYSROOT=/dummy
ENV LIBPQ_STATIC=1
WORKDIR /wd
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --bins --release

FROM scratch
EXPOSE 3001/tcp
ENV RUST_LOG=info
USER 65534:65534
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /wd/target/release/nyancatchat-ng /

CMD ["./nyancatchat-ng"]
