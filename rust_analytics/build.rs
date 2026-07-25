use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    // Try to find analytics.proto in order of preference.
    let proto_paths = [
        manifest_dir.join("protos/analytics.proto"),
        manifest_dir.join("../protos/analytics.proto"),
        PathBuf::from("/protos/analytics.proto"),
    ];

    let proto_file = proto_paths
        .iter()
        .find(|path| path.exists())
        .cloned()
        .ok_or_else(|| {
            let checked = proto_paths
                .iter()
                .map(|path| path.display().to_string())
                .collect::<Vec<_>>()
                .join(", ");

            format!("analytics.proto was not found. Checked: {checked}")
        })?;

    let include_dir = proto_file
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| manifest_dir.clone());

    tonic_prost_build::configure().compile_protos(&[proto_file], &[include_dir])?;

    Ok(())
}
