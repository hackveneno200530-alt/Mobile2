import { Injectable, inject, signal } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
  title?: string;
  categoryTag?: string;
  likes?: number;
  liked?: boolean;
  date?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PhotoService {
  public photos = signal<UserPhoto[]>([]);
  private PHOTO_STORAGE: string = 'delrio_community_photos_v2';
  private platform = inject(Platform);

  // Fotografías de muestra iniciales para la comunidad Del Río
  private defaultCommunityPhotos: UserPhoto[] = [
    {
      filepath: 'sample_streetwear_1',
      webviewPath: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=800',
      title: 'Outfit Urbano con Snapback Del Río',
      categoryTag: 'Gorras & Streetwear',
      likes: 24,
      liked: false,
      date: 'Hoy, 18:30',
    },
    {
      filepath: 'sample_streetwear_2',
      webviewPath: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800',
      title: 'Nike Air Force 1 recién llegados',
      categoryTag: 'Sneakers',
      likes: 41,
      liked: true,
      date: 'Ayer, 14:15',
    },
    {
      filepath: 'sample_streetwear_3',
      webviewPath: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800',
      title: 'Fragancia del Día: Sauvage Elixir',
      categoryTag: 'Perfumería',
      likes: 18,
      liked: false,
      date: '23 Octubre',
    },
  ];

  public async addNewToGallery(source: CameraSource = CameraSource.Prompt) {
    try {
      const capturedPhoto = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: source,
        quality: 90,
        allowEditing: false,
      });

      const savedImageFile = await this.savePicture(capturedPhoto);
      savedImageFile.title = 'Mi Outfit Del Río Caps';
      savedImageFile.categoryTag = 'Comunidad Del Río';
      savedImageFile.likes = 1;
      savedImageFile.liked = true;
      savedImageFile.date = 'Justo ahora';

      this.photos.update((photos) => [savedImageFile, ...photos]);

      await Preferences.set({
        key: this.PHOTO_STORAGE,
        value: JSON.stringify(this.photos()),
      });
      return true;
    } catch (error) {
      console.warn('[Camera] Cancelado o sin permiso:', error);
      return false;
    }
  }

  private async savePicture(photo: Photo): Promise<UserPhoto> {
    let base64Data: string | Blob;

    if (this.platform.is('hybrid')) {
      const file = await Filesystem.readFile({
        path: photo.path!,
      });
      base64Data = file.data;
    } else {
      base64Data = await this.base64FromPath(photo.webPath!);
    }

    const fileName = 'delrio_' + Date.now() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data,
    });

    if (this.platform.is('hybrid')) {
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
      };
    } else {
      return {
        filepath: fileName,
        webviewPath: photo.webPath,
      };
    }
  }

  private async base64FromPath(path: string): Promise<string> {
    const response = await fetch(path);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject('method did not return a string');
        }
      };
      reader.readAsDataURL(blob);
    });
  }

  public async loadSaved() {
    const { value: photoList } = await Preferences.get({ key: this.PHOTO_STORAGE });
    let savedPhotos = (photoList ? JSON.parse(photoList) : []) as UserPhoto[];

    if (savedPhotos.length === 0) {
      savedPhotos = [...this.defaultCommunityPhotos];
      await Preferences.set({
        key: this.PHOTO_STORAGE,
        value: JSON.stringify(savedPhotos),
      });
    }

    if (!this.platform.is('hybrid')) {
      for (const photo of savedPhotos) {
        if (photo.filepath.startsWith('delrio_')) {
          try {
            const readFile = await Filesystem.readFile({
              path: photo.filepath,
              directory: Directory.Data,
            });
            photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
          } catch {
            // fallback al path existente
          }
        }
      }
    }

    this.photos.set(savedPhotos);
  }

  public toggleLike(position: number) {
    this.photos.update((list) => {
      return list.map((item, idx) => {
        if (idx === position) {
          const liked = !item.liked;
          const likes = (item.likes ?? 0) + (liked ? 1 : -1);
          return { ...item, liked, likes: Math.max(0, likes) };
        }
        return item;
      });
    });

    Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos()),
    });
  }

  public async deletePhoto(photo: UserPhoto, position: number) {
    this.photos.update((photos) => photos.filter((_, index) => index !== position));

    await Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos()),
    });

    if (photo.filepath.startsWith('delrio_') || photo.filepath.includes('/')) {
      try {
        const filename = photo.filepath.slice(photo.filepath.lastIndexOf('/') + 1);
        await Filesystem.deleteFile({
          path: filename,
          directory: Directory.Data,
        });
      } catch (e) {
        console.warn('No se pudo borrar archivo físico:', e);
      }
    }
  }
}
