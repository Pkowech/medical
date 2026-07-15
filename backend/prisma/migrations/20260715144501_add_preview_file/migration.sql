-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "preview_file_id" TEXT;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_preview_file_id_fkey" FOREIGN KEY ("preview_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
