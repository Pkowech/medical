BEGIN;

ALTER TABLE "user_activities" DROP CONSTRAINT "user_activities_user_id_fkey";
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "unit_accesses" DROP CONSTRAINT "unit_accesses_user_id_fkey";
ALTER TABLE "unit_accesses" ADD CONSTRAINT "unit_accesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auto_generated_quizzes" DROP CONSTRAINT "auto_generated_quizzes_user_id_fkey";
ALTER TABLE "auto_generated_quizzes" ADD CONSTRAINT "auto_generated_quizzes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quiz_attempts" DROP CONSTRAINT "quiz_attempts_user_id_fkey";
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_responses" DROP CONSTRAINT "user_responses_user_id_fkey";
ALTER TABLE "user_responses" ADD CONSTRAINT "user_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_flashcard_progress" DROP CONSTRAINT "user_flashcard_progress_user_id_fkey";
ALTER TABLE "user_flashcard_progress" ADD CONSTRAINT "user_flashcard_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_skill_states" DROP CONSTRAINT "user_skill_states_user_id_fkey";
ALTER TABLE "user_skill_states" ADD CONSTRAINT "user_skill_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cpd_cycles" DROP CONSTRAINT "cpd_cycles_user_id_fkey";
ALTER TABLE "cpd_cycles" ADD CONSTRAINT "cpd_cycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "unit_completions" DROP CONSTRAINT "unit_completions_user_id_fkey";
ALTER TABLE "unit_completions" ADD CONSTRAINT "unit_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
