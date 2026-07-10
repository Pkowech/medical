fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_prost_build::configure().compile_protos(&["../protos/analytics.proto"], &["../protos"])?;
    // Proto compilation disabled due to tonic version compatibility issues
    Ok(())
}
