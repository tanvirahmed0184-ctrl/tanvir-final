import "dotenv/config";
import prisma from "@/lib/prisma";

const ACADEMIC_READING_PASSAGE = `Across many large cities, urban wildlife has adapted in ways that surprise researchers and residents alike. Foxes roam quiet streets at night, peregrine falcons nest on high office towers, and hedgehogs use small garden corridors to travel between neighborhoods. Scientists now describe this adaptation as behavioral flexibility: animals learn to use human-made spaces for shelter, food, and movement. While some people worry that wildlife in cities is dangerous, most interactions are brief and non-aggressive. Problems usually appear when humans feed animals directly, leave food waste exposed, or disturb nesting areas.

City planners in several countries have started to include biodiversity goals in transport, housing, and park projects. Green roofs support insects and birds, native plants provide reliable food sources, and connected green spaces reduce habitat fragmentation. Public education campaigns also help residents understand how to coexist with local species safely. Importantly, urban wildlife presence can improve mental well-being by increasing everyday contact with nature. Experts argue that cities should not treat wildlife as accidental visitors but as long-term neighbors. With careful policy, responsible public behavior, and better habitat design, urban areas can support both human communities and healthy wildlife populations at the same time.`;

const GENERAL_READING_PASSAGE = `Workplace safety is not only the responsibility of managers; every employee has a role in preventing accidents. Before starting a task, workers should check equipment, follow written procedures, and report hazards immediately. Common risks include wet floors, blocked exits, poor lighting, and incorrect lifting methods. Employers must provide training, protective equipment, and clear emergency instructions, while employees must use that guidance correctly. Regular safety meetings help teams review incidents and improve routines. A strong safety culture reduces injuries, protects productivity, and builds trust among staff.`;

async function createReadingAcademicTest() {
  const test = await prisma.test.create({
    data: {
      title: "Academic Reading Practice Test 1",
      module: "READING",
      variant: "ACADEMIC",
      difficulty: "MEDIUM",
      durationMins: 60,
      totalQuestions: 4,
      isPractice: true,
      isActive: true,
      description: "Academic reading practice with urban wildlife passage.",
    },
  });

  const section = await prisma.testSection.create({
    data: {
      testId: test.id,
      title: "Passage 1",
      order: 1,
      passage: ACADEMIC_READING_PASSAGE,
    },
  });

  await prisma.question.create({
    data: {
      testId: test.id,
      sectionId: section.id,
      type: "MULTIPLE_CHOICE",
      order: 1,
      questionText: "What is the main idea of the passage?",
      correctAnswer: "B",
      acceptedAnswers: ["B"],
      explanation:
        "The passage focuses on how wildlife adapts to cities and how people can support coexistence.",
      points: 1,
      options: {
        create: [
          {
            label: "A",
            text: "Urban wildlife should be removed from cities",
            isCorrect: false,
          },
          {
            label: "B",
            text: "Cities can support both people and wildlife with good planning",
            isCorrect: true,
          },
          {
            label: "C",
            text: "Wildlife in cities is always dangerous",
            isCorrect: false,
          },
          {
            label: "D",
            text: "Only parks matter for biodiversity",
            isCorrect: false,
          },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      testId: test.id,
      sectionId: section.id,
      type: "TRUE_FALSE_NOT_GIVEN",
      order: 2,
      questionText:
        "Most interactions between people and urban wildlife are aggressive.",
      correctAnswer: "FALSE",
      acceptedAnswers: ["FALSE"],
      explanation:
        "The passage states that most interactions are brief and non-aggressive.",
      points: 1,
    },
  });

  await prisma.question.create({
    data: {
      testId: test.id,
      sectionId: section.id,
      type: "TRUE_FALSE_NOT_GIVEN",
      order: 3,
      questionText: "Green roofs can help support urban biodiversity.",
      correctAnswer: "TRUE",
      acceptedAnswers: ["TRUE"],
      explanation:
        "The passage explicitly mentions green roofs supporting insects and birds.",
      points: 1,
    },
  });

  await prisma.question.create({
    data: {
      testId: test.id,
      sectionId: section.id,
      type: "FILL_IN_BLANK",
      order: 4,
      questionText:
        "Experts say cities should treat wildlife as long-term __________ rather than accidental visitors.",
      correctAnswer: "neighbors",
      acceptedAnswers: ["neighbors", "neighbours"],
      explanation: "The passage uses the phrase long-term neighbors.",
      points: 1,
    },
  });
}

async function createListeningAcademicTest() {
  const test = await prisma.test.create({
    data: {
      title: "Listening Practice Test 1",
      module: "LISTENING",
      variant: "ACADEMIC",
      difficulty: "MEDIUM",
      durationMins: 30,
      totalQuestions: 4,
      isPractice: true,
      isActive: true,
      description: "Academic listening practice with form and note completion.",
    },
  });

  const section = await prisma.testSection.create({
    data: {
      testId: test.id,
      title: "Section 1",
      order: 1,
      passage: "Audio transcript placeholder for listening practice test 1.",
    },
  });

  await prisma.question.create({
    data: {
      testId: test.id,
      sectionId: section.id,
      type: "FILL_IN_BLANK",
      order: 1,
      questionText: "The orientation session starts at ___ a.m.",
      correctAnswer: "9:30",
      acceptedAnswers: ["9:30", "9.30"],
      explanation: "The speaker confirms the start time as nine-thirty.",
      points: 1,
    },
  });

  await prisma.question.create({
    data: {
      testId: test.id,
      sectionId: section.id,
      type: "FILL_IN_BLANK",
      order: 2,
      questionText: "Students should bring their ___ card for registration.",
      correctAnswer: "ID",
      acceptedAnswers: ["ID", "identification"],
      explanation: "The recording asks for an ID card.",
      points: 1,
    },
  });

  await prisma.question.create({
    data: {
      testId: test.id,
      sectionId: section.id,
      type: "FILL_IN_BLANK",
      order: 3,
      questionText: "The library tour lasts ___ minutes.",
      correctAnswer: "45",
      acceptedAnswers: ["45", "forty-five", "forty five"],
      explanation: "The guide says the tour duration is forty-five minutes.",
      points: 1,
    },
  });

  await prisma.question.create({
    data: {
      testId: test.id,
      sectionId: section.id,
      type: "FILL_IN_BLANK",
      order: 4,
      questionText: "Participants should email questions to ___@campus.edu.",
      correctAnswer: "support",
      acceptedAnswers: ["support"],
      explanation: "The contact mailbox given is support@campus.edu.",
      points: 1,
    },
  });
}

async function createReadingGeneralTest() {
  const test = await prisma.test.create({
    data: {
      title: "General Training Reading Test 1",
      module: "READING",
      variant: "GENERAL",
      difficulty: "MEDIUM",
      durationMins: 60,
      totalQuestions: 3,
      isPractice: false,
      isActive: true,
      description: "General training workplace safety reading test.",
    },
  });

  const section = await prisma.testSection.create({
    data: {
      testId: test.id,
      title: "Passage 1",
      order: 1,
      passage: GENERAL_READING_PASSAGE,
    },
  });

  await prisma.question.create({
    data: {
      testId: test.id,
      sectionId: section.id,
      type: "TRUE_FALSE_NOT_GIVEN",
      order: 1,
      questionText: "Only managers are responsible for workplace safety.",
      correctAnswer: "FALSE",
      acceptedAnswers: ["FALSE"],
      explanation: "The passage says every employee has a role.",
      points: 1,
    },
  });

  await prisma.question.create({
    data: {
      testId: test.id,
      sectionId: section.id,
      type: "TRUE_FALSE_NOT_GIVEN",
      order: 2,
      questionText: "Regular safety meetings can improve workplace routines.",
      correctAnswer: "TRUE",
      acceptedAnswers: ["TRUE"],
      explanation: "The passage states meetings help teams improve routines.",
      points: 1,
    },
  });

  await prisma.question.create({
    data: {
      testId: test.id,
      sectionId: section.id,
      type: "MULTIPLE_CHOICE",
      order: 3,
      questionText:
        "Which of the following is listed as a common workplace risk?",
      correctAnswer: "C",
      acceptedAnswers: ["C"],
      explanation: "The passage includes blocked exits as a common risk.",
      points: 1,
      options: {
        create: [
          { label: "A", text: "Daily weather reports", isCorrect: false },
          { label: "B", text: "Optional staff uniforms", isCorrect: false },
          { label: "C", text: "Blocked exits", isCorrect: true },
          { label: "D", text: "Extended lunch breaks", isCorrect: false },
        ],
      },
    },
  });
}

async function createWritingPrompts() {
  await prisma.writingPrompt.create({
    data: {
      title: "Task 2 Technology and Education",
      taskType: "TASK_2",
      promptText:
        "Some people believe that technology in classrooms improves learning outcomes, while others think it distracts students. Discuss both views and give your own opinion.",
      variant: "ACADEMIC",
      difficulty: "MEDIUM",
      topic: "Technology",
      isActive: true,
    },
  });

  await prisma.writingPrompt.create({
    data: {
      title: "Task 1 Academic Line Graph",
      taskType: "TASK_1_ACADEMIC",
      promptText:
        "The graph below shows changes in public transport usage in a city between 2010 and 2020. Summarize the information by selecting and reporting the main features, and make comparisons where relevant.",
      variant: "ACADEMIC",
      difficulty: "MEDIUM",
      topic: "Data Report",
      isActive: true,
    },
  });
}

async function main() {
  await prisma.answer.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.testSection.deleteMany();

  await prisma.test.deleteMany({
    where: {
      title: {
        in: [
          "Academic Reading Practice Test 1",
          "Listening Practice Test 1",
          "General Training Reading Test 1",
        ],
      },
    },
  });

  await prisma.writingPrompt.deleteMany({
    where: {
      title: {
        in: ["Task 2 Technology and Education", "Task 1 Academic Line Graph"],
      },
    },
  });

  await createReadingAcademicTest();
  await createListeningAcademicTest();
  await createReadingGeneralTest();
  await createWritingPrompts();

  console.log("Seeded successfully!");
  console.log("Tests: 3, Questions: 11, Writing: 2");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
