use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    
    // Try to find analytics.proto in order of preference
    let proto_paths = [
        manifest_dir.join("protos/analytics.proto"),
        manifest_dir.join("../protos/analytics.proto"),
        PathBuf::from("/protos/analytics.proto"),
    ];
    
    if let Some(proto_file) = proto_paths.into_iter().find(|path| path.exists()) {
        let include_dir = proto_file
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| manifest_dir.clone());
        tonic_prost_build::configure().compile_protos(&[proto_file.clone()], &[include_dir])?;
    } else {
        // Proto file not found - this is OK during container builds
        // The additional_contexts in compose.yaml will provide it
        eprintln!("Warning: analytics.proto not found, skipping protobuf compilation");
    }
    
    Ok(())
}
