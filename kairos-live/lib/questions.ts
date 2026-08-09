import type { Question } from "./types";

// Curated, verifiable questions. References are real; the AI Host only SELECTS
// and NARRATES from this bank — it never generates scripture. This is a
// deliberate design choice that satisfies the hackathon rule and keeps
// content trustworthy (see ARCHITECTURE.md).
export const QUESTIONS: Question[] = [
  {
    id: "q-arca",
    prompt: "¿Quién construyó el arca?",
    options: ["Abraham", "Noé", "Moisés", "David"],
    correct: 1,
    reference: "Génesis 6:14",
    difficulty: "facil",
  },
  {
    id: "q-mar-rojo",
    prompt: "¿Quién dividió el Mar Rojo?",
    options: ["Josué", "Elías", "Moisés", "Aarón"],
    correct: 2,
    reference: "Éxodo 14:21",
    difficulty: "facil",
  },
  {
    id: "q-pez",
    prompt: "¿Qué profeta fue tragado por un gran pez?",
    options: ["Jonás", "Amós", "Oseas", "Joel"],
    correct: 0,
    reference: "Jonás 1:17",
    difficulty: "facil",
  },
  {
    id: "q-panes",
    prompt: "¿Con cuántos panes alimentó Jesús a los cinco mil?",
    options: ["Dos", "Cinco", "Siete", "Doce"],
    correct: 1,
    reference: "Mateo 14:17",
    difficulty: "facil",
  },
  {
    id: "q-primer-hombre",
    prompt: "¿Cómo se llamaba el primer hombre?",
    options: ["Caín", "Set", "Adán", "Enós"],
    correct: 2,
    reference: "Génesis 2:7",
    difficulty: "facil",
  },
  {
    id: "q-gigante",
    prompt: "¿A qué gigante venció David?",
    options: ["Og", "Goliat", "Sansón", "Nimrod"],
    correct: 1,
    reference: "1 Samuel 17:50",
    difficulty: "media",
  },
  {
    id: "q-evangelios",
    prompt: "¿Cuál de estos NO es un evangelio?",
    options: ["Marcos", "Lucas", "Hechos", "Juan"],
    correct: 2,
    reference: "Hechos 1:1",
    difficulty: "media",
  },
  {
    id: "q-tablas",
    prompt: "¿En qué monte recibió Moisés los diez mandamientos?",
    options: ["Sinaí", "Carmelo", "Nebo", "Sion"],
    correct: 0,
    reference: "Éxodo 19:20",
    difficulty: "media",
  },
  {
    id: "q-negacion",
    prompt: "¿Cuántas veces negó Pedro a Jesús?",
    options: ["Una", "Dos", "Tres", "Siete"],
    correct: 2,
    reference: "Mateo 26:75",
    difficulty: "media",
  },
  {
    id: "q-leones",
    prompt: "¿Quién fue arrojado al foso de los leones?",
    options: ["Daniel", "Ezequiel", "Jeremías", "Isaías"],
    correct: 0,
    reference: "Daniel 6:16",
    difficulty: "media",
  },
  {
    id: "q-primer-milagro",
    prompt: "¿Cuál fue el primer milagro de Jesús según Juan?",
    options: [
      "Sanar a un ciego",
      "Convertir agua en vino",
      "Caminar sobre el agua",
      "Resucitar a Lázaro",
    ],
    correct: 1,
    reference: "Juan 2:11",
    difficulty: "dificil",
  },
  {
    id: "q-cartas-pablo",
    prompt: "¿A cuál de estas iglesias NO escribió Pablo una carta?",
    options: ["Corinto", "Éfeso", "Antioquía", "Filipos"],
    correct: 2,
    reference: "Colosenses 4:16",
    difficulty: "dificil",
  },
  {
    id: "q-rey-sabio",
    prompt: "¿Qué rey pidió sabiduría a Dios en un sueño?",
    options: ["Saúl", "David", "Salomón", "Ezequías"],
    correct: 2,
    reference: "1 Reyes 3:9",
    difficulty: "dificil",
  },
  {
    id: "q-apocalipsis",
    prompt: "¿En qué isla escribió Juan el Apocalipsis?",
    options: ["Chipre", "Patmos", "Creta", "Malta"],
    correct: 1,
    reference: "Apocalipsis 1:9",
    difficulty: "dificil",
  },
  {
    id: "q-fruto",
    prompt: "¿Cuál NO es parte del fruto del Espíritu en Gálatas 5?",
    options: ["Paciencia", "Bondad", "Riqueza", "Templanza"],
    correct: 2,
    reference: "Gálatas 5:22-23",
    difficulty: "dificil",
  },
];

export function byDifficulty(diff: string): Question[] {
  return QUESTIONS.filter((q) => q.difficulty === diff);
}
