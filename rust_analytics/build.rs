use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let proto_file = [
        manifest_dir.join("../protos/analytics.proto"),
        manifest_dir.join("protos/analytics.proto"),
    ]
    .into_iter()
    .find(|path| path.exists())
    .unwrap_or_else(|| manifest_dir.join("../protos/analytics.proto"));

    let include_dir = proto_file.parent().unwrap_or(&manifest_dir);
    let proto_file_for_build = proto_file.clone();

    tonic_prost_build::configure().compile_protos(&[proto_file_for_build], &[include_dir.to_path_buf()])?;
    Ok(())
}
