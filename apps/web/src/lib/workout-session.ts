import type { WorkoutSessionFormValues } from '@/components/workout/WorkoutSessionForm';
import {
  workoutSessionExerciseService,
  workoutSessionService,
  workoutSessionSetService,
} from '@/services/workout-service';

/** Cria a sessão de treino com seus exercícios e séries (Treino e revisão diária). */
export async function createWorkoutSession(
  data: WorkoutSessionFormValues,
  ownerId: number
) {
  const session = await workoutSessionService.create({
    workout_day:
      data.workout_day && data.workout_day !== 'none'
        ? Number(data.workout_day)
        : undefined,
    date: data.date,
    started_at: data.started_at || undefined,
    finished_at: data.finished_at || undefined,
    notes: data.notes || undefined,
    owner: ownerId,
  });

  await Promise.all(
    data.exercises.map(async (ex, exIdx) => {
      const sessionEx = await workoutSessionExerciseService.create({
        session: session.id,
        exercise: ex.exercise ?? undefined,
        exercise_name: ex.exercise_name,
        sets_target: ex.sets_target,
        reps_target_min: ex.reps_target_min,
        reps_target_max: ex.reps_target_max,
        load_target: ex.load_target || undefined,
        load_target_unit: ex.load_target_unit,
        order: exIdx,
        owner: ownerId,
      });
      await Promise.all(
        ex.sets.map((s, sIdx) =>
          workoutSessionSetService.create({
            session_exercise: sessionEx.id,
            set_number: sIdx + 1,
            load: s.load || undefined,
            load_unit: s.load_unit,
            reps_done: s.reps_done ? Number(s.reps_done) : undefined,
            completed: s.completed,
            notes: s.notes || undefined,
            owner: ownerId,
          })
        )
      );
    })
  );
  return session;
}
