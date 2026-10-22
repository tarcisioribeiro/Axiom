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
        execution_count_target: ex.execution_count_target,
        duration_target_seconds: ex.duration_target_seconds,
        is_lateral: ex.is_lateral,
        avg_speed_target: ex.avg_speed_target || undefined,
        incline_target_percent: ex.incline_target_percent || undefined,
        has_speed_intervals: ex.has_speed_intervals,
        interval_target_seconds: ex.interval_target_seconds,
        interval_count_target: ex.interval_count_target,
        interval_speed_high_target: ex.interval_speed_high_target || undefined,
        interval_speed_low_target: ex.interval_speed_low_target || undefined,
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
            duration_seconds: s.duration_seconds
              ? Number(s.duration_seconds)
              : undefined,
            avg_speed: s.avg_speed || undefined,
            incline_percent: s.incline_percent || undefined,
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
