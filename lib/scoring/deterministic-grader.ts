export function gradeAnswer(
  userAnswer: string | null | undefined,
  correctAnswer: string,
  acceptedAnswers: string[] = [],
): boolean {
  if (!userAnswer) return false;
  const norm = (s: string) => s.trim().toLowerCase();
  const all = [correctAnswer, ...acceptedAnswers].map(norm);
  return all.includes(norm(userAnswer));
}

export function gradeAttempt(
  answers: Array<{
    userAnswer: unknown;
    correctAnswer: unknown;
    acceptedAnswers: unknown;
    points: number;
  }>,
) {
  let correctCount = 0;
  let totalPoints = 0;
  let maxPoints = 0;

  const results = answers.map((a) => {
    maxPoints += a.points;
    const isCorrect = gradeAnswer(
      String(a.userAnswer ?? ""),
      String(a.correctAnswer ?? ""),
      Array.isArray(a.acceptedAnswers) ? a.acceptedAnswers.map(String) : [],
    );
    if (isCorrect) {
      correctCount++;
      totalPoints += a.points;
    }
    return { isCorrect };
  });

  return { correctCount, totalPoints, maxPoints, results };
}
