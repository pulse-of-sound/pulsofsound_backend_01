import fs from 'fs';
import path from 'path';
import axios from 'axios';
require('dotenv').config();

const appId = process.env.appId!;
const restAPIKey = process.env.restAPIKey!;
const masterKey = process.env.masterKey!;
const serverURL = process.env.serverURL!;

const folderPath = 'C:/Users/DELL/Desktop/Pulse Of Sound/LevelGame';
const levelGameId = 'VPKgp7ow4R';

async function uploadParseFile(fileName: string): Promise<string> {
  const filePath = path.join(folderPath, fileName);
  const data = fs.readFileSync(filePath);

  const response = await axios.post(`${serverURL}/files/${fileName}`, data, {
    headers: {
      'X-Parse-Application-Id': appId,
      'X-Parse-REST-API-Key': restAPIKey,
      'X-Parse-Master-Key': masterKey,
      'Content-Type': 'image/jpeg',
    },
  });

  return response.data.url;
}

async function saveStageQuestion(question: any): Promise<void> {
  await axios.post(`${serverURL}/classes/StageQuestion`, question, {
    headers: {
      'X-Parse-Application-Id': appId,
      'X-Parse-REST-API-Key': restAPIKey,
      'X-Parse-Master-Key': masterKey,
      'Content-Type': 'application/json',
    },
  });
}

async function seedStageQuestions() {
  try {
    console.log('Uploading images...');

    const girl1 = await uploadParseFile('Girl1.jpg');
    const boy1 = await uploadParseFile('Boy1.jpg');
    const boy = await uploadParseFile('boy.jpg');
    const girl = await uploadParseFile('girl.jpg');

    const questions = [
      {
        question_type: 'view_only',
        instruction: 'شاهد الصور التالية',
        images: [girl1, boy1],
      },
      {
        question_type: 'choose',
        instruction: 'اختر الصورة التي تمثل ولدًا',
        images: [boy, girl],
        correct_answer: {index: 0},
        options: {labels: ['ولد', 'بنت']},
      },
      {
        question_type: 'match',
        instruction: 'صل كل صورة بما يناسبها',
        images: [boy, girl, boy1, girl1],
        correct_answer: {
          pairs: [
            {left: 0, right: 2},
            {left: 1, right: 3},
          ],
        },
      },
      {
        question_type: 'view_only',
        instruction: 'شاهد هذه الصورة',
        images: [girl],
      },
      {
        question_type: 'classify',
        instruction: 'صنّف الصور إلى أولاد وبنات',
        images: [boy, girl, boy1, girl1],
        correct_answer: {
          boy: [0, 2],
          girl: [1, 3],
        },
      },
    ];

    for (let index = 0; index < questions.length; index++) {
      const q = questions[index];

      const payload = {
        level_game_id: {
          __type: 'Pointer',
          className: 'LevelGame',
          objectId: levelGameId,
        },
        question_type: q.question_type,
        instruction: q.instruction,
        images: q.images,
        correct_answer: q.correct_answer || null,
        options: q.options || null,
        order: index,
        created_at: {__type: 'Date', iso: new Date().toISOString()},
        updated_at: {__type: 'Date', iso: new Date().toISOString()},
      };

      await saveStageQuestion(payload);
      console.log(`Question ${index + 1} of type ${q.question_type} saved`);
    }

    console.log(' All stage questions seeded successfully!');
  } catch (error: any) {
    console.error(' Error:', error.response?.data || error.message);
  }
}

seedStageQuestions().catch(err => {
  console.error('Fatal Error:', err);
});
