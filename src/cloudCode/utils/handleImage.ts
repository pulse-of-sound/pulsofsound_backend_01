import IMG from '../models/IMG';
import {catchError} from './catchError';

async function createImageFromBase64(
  base64: string,
  name: string
): Promise<Parse.File> {
  const safeName = encodeURIComponent(name || 'image.webp');
  const file = new Parse.File(safeName, {base64});
  return await file.save({useMasterKey: true});
}

async function destroyOldImage(
  id: string,
  className: string,
  attributeName: string
) {
  if (!id) return;

  const query = new Parse.Query(className);
  query.equalTo('objectId', id);
  query.include([attributeName]);
  const classObject = await query.first({useMasterKey: true});
  const oldImg = classObject?.get(attributeName);

  if (oldImg && typeof oldImg.destroy === 'function') {
    await oldImg.destroy({useMasterKey: true});
    console.log('Old image destroyed');
  }
}

export async function handleImageLogic<T extends Parse.Object>(
  object: T,
  file: any,
  id: string | undefined,
  attributeName: string
): Promise<void> {
  const className = object.className;

  if (!file) return;

  if (!file?.image && !id) return;

  if (!file.image?.url && !file.image?.base64 && id) {
    console.log('No image provided, removing old image if exists');

    const [error] = await catchError(
      destroyOldImage(id!, className, attributeName)
    );
    if (error) {
      console.error('Error destroying old image:', error);
    }
    return;
  }

  const imgObj = new IMG();

  if (file?.image?.base64 && file?.image?.name) {
    console.log('Uploading new image');

    const [error] = await catchError(
      destroyOldImage(id!, className, attributeName)
    );
    if (error) {
      console.error('Error destroying old image:', error);
    }

    const [uploadError, fileUpload] = await catchError(
      createImageFromBase64(file.image.base64, file.image.name)
    );

    if (uploadError) {
      console.error('File upload failed:', uploadError);
      return;
    }

    console.log('File uploaded successfully');

    imgObj.image = fileUpload;
    if (file.imageThumbNail) imgObj.imageThumbNail = file.imageThumbNail;
    if (file.blurHash) imgObj.blurHash = file.blurHash;
  }

  if (file?.id && file?.image?.url && !file?.image?.base64) {
    console.log('Referencing existing image, setting only pointer');
    imgObj.id = file.id;
  }

  object.set(attributeName, imgObj);
}

export async function handleImageArrayLogic<T extends Parse.Object>(
  object: T,
  files: any[] = [],
  id: string | undefined,
  attributeName: string
): Promise<void> {
  const className = object.className;

  const incomingIds = new Set(
    files
      .map(f => {
        if (f && f.id && f.className === 'IMG') {
          return f.id;
        }
        if (f && f.image && f.image.id) {
          return f.image.id;
        }
        return null;
      })
      .filter(Boolean)
  );
  const newImages: IMG[] = [];

  if (id) {
    const query = new Parse.Query(className);
    query.equalTo('objectId', id);
    query.include([attributeName]);

    const existingObj = await query.first({useMasterKey: true});
    const currentImages: IMG[] = existingObj?.get(attributeName) || [];

    for (const img of currentImages) {
      if (!incomingIds.has(img.id)) {
        const [error] = await catchError(img.destroy({useMasterKey: true}));
        if (error) {
          console.error('Error destroying old image:', error);
        }
      }
    }
  }

  for (const fileWrapper of files) {
    let imgObj = new IMG();

    if (fileWrapper && fileWrapper.image && fileWrapper.image.base64) {
      console.log('Uploading new image with wrapper');
      const file = fileWrapper.image;

      const [uploadError, parseFile] = await catchError(
        createImageFromBase64(file.base64, file.name)
      );
      if (uploadError) {
        console.error('File upload failed:', uploadError);
        continue;
      }

      imgObj.image = parseFile;
      if (file.imageThumbNail) imgObj.imageThumbNail = file.imageThumbNail;
      if (file.blurHash) imgObj.blurHash = file.blurHash;
      newImages.push(imgObj);
      continue;
    }

    if (
      fileWrapper &&
      fileWrapper.image &&
      fileWrapper.id &&
      fileWrapper.image.url &&
      !fileWrapper.image.base64
    ) {
      console.log('Referencing existing image by id and url');
      imgObj.id = fileWrapper.id;
      newImages.push(imgObj);
      continue;
    }
  }
  object.set(attributeName, newImages);
}
