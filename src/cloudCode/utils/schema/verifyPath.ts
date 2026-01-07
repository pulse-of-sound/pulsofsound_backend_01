import {verifyImagesFolder} from './seed';

export async function testImagesFolder() {
  const isValid = verifyImagesFolder();

  if (isValid) {
    console.log('Images folder is accessible and ready for seeding!');
  } else {
    console.log(' Images folder is not accessible. Please check the path.');
  }

  return isValid;
}
