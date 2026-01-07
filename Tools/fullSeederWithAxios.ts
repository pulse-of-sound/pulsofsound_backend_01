import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const appId = process.env.appId!;
const restAPIKey = process.env.restAPIKey!;
const masterKey = process.env.masterKey!;
const serverURL = process.env.serverURL!;

const folderPath = 'C:/Users/DELL/Desktop/Pulse Of Sound/PlacementTestQuestion';
const correctAnswers = [
  'C', 'B', 'B', 'A', 'D',
  'C', 'D', 'B', 'A', 'D',
  'A', 'B', 'D', 'D', 'C'
];

async function uploadParseFile(fileName: string): Promise<{ name: string }> {
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

  return { name: response.data.name };
}

async function saveQuestion(images: Record<string, { name: string }>): Promise<string> {
  const response = await axios.post(`${serverURL}/classes/PlacementTestQuestion`, {
    question_image_url: {
      __type: 'File',
      name: images.question.name,
    },
    option_a_image_url: {
      __type: 'File',
      name: images.a.name,
    },
    option_b_image_url: {
      __type: 'File',
      name: images.b.name,
    },
    option_c_image_url: {
      __type: 'File',
      name: images.c.name,
    },
    option_d_image_url: {
      __type: 'File',
      name: images.d.name,
    },
  }, {
    headers: {
      'X-Parse-Application-Id': appId,
      'X-Parse-REST-API-Key': restAPIKey,
      'X-Parse-Master-Key': masterKey,
      'Content-Type': 'application/json',
    },
  });

  return response.data.objectId;
}

async function saveAnswer(questionId: string, correctOption: string): Promise<void> {
  await axios.post(`${serverURL}/classes/PlacementTestCorrectAnswer`, {
    correct_option: correctOption,
    question: {
      __type: 'Pointer',
      className: 'PlacementTestQuestion',
      objectId: questionId,
    },
  }, {
    headers: {
      'X-Parse-Application-Id': appId,
      'X-Parse-REST-API-Key': restAPIKey,
      'X-Parse-Master-Key': masterKey,
      'Content-Type': 'application/json',
    },
  });
}

async function seedAll() {
  for (let i = 1; i <= 15; i++) {
    console.log(` Processing question ${i}`);

    try {
      const images = {
        question: await uploadParseFile(`q${i}.jpg`),
        a: await uploadParseFile(`q${i}_a.jpg`),
        b: await uploadParseFile(`q${i}_b.jpg`),
        c: await uploadParseFile(`q${i}_c.jpg`),
        d: await uploadParseFile(`q${i}_d.jpg`),
      };

      const questionId = await saveQuestion(images);
      await saveAnswer(questionId, correctAnswers[i - 1]);

      console.log(` Question ${i} saved`);
    } catch (error: any) {
      console.error(` Error in question ${i}:`, error.response?.data || error.message);
    }
  }

  console.log(' All questions and answers seeded successfully!');
}

seedAll().catch(err => {
  console.error(' Fatal Error:', err);
});
