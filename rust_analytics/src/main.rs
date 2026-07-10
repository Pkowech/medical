use dotenvy::dotenv;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    rust_analytics::run().await
}
