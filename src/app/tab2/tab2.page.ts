import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonFab,
  IonFabButton,
  IonIcon,
  IonBadge,
  IonButton,
  IonChip,
  IonModal,
  IonButtons,
  ActionSheetController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  camera,
  images,
  heart,
  heartOutline,
  trash,
  close,
  shareSocialOutline,
  sparkles,
  expandOutline,
} from 'ionicons/icons';
import { CameraSource } from '@capacitor/camera';
import type { UserPhoto } from '../services/photo.service';
import { PhotoService } from '../services/photo.service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonFab,
    IonFabButton,
    IonIcon,
    IonBadge,
    IonButton,
    IonChip,
    IonModal,
    IonButtons,
  ],
})
export class Tab2Page implements OnInit {
  public photoService = inject(PhotoService);
  private actionSheetCtrl = inject(ActionSheetController);

  public selectedCategory = signal<string>('todos');
  public previewPhoto = signal<UserPhoto | null>(null);
  public previewIndex = signal<number>(-1);

  public filteredPhotos = computed(() => {
    const cat = this.selectedCategory().toLowerCase();
    const list = this.photoService.photos();
    if (cat === 'todos') return list;
    return list.filter((p) => p.categoryTag?.toLowerCase().includes(cat));
  });

  constructor() {
    addIcons({
      camera,
      images,
      heart,
      heartOutline,
      trash,
      close,
      shareSocialOutline,
      sparkles,
      expandOutline,
    });
  }

  async ngOnInit() {
    await this.photoService.loadSaved();
  }

  async openCameraPrompt() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Subir Foto a Comunidad Del Río',
      subHeader: 'Comparte tu estilo con gorras, calzado o fragancias',
      buttons: [
        {
          text: 'Tomar Foto con Cámara',
          icon: 'camera',
          handler: () => {
            this.photoService.addNewToGallery(CameraSource.Camera);
          },
        },
        {
          text: 'Elegir de Galería del Dispositivo',
          icon: 'images',
          handler: () => {
            this.photoService.addNewToGallery(CameraSource.Photos);
          },
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel',
        },
      ],
    });
    await actionSheet.present();
  }

  onLike(position: number, event: Event) {
    event.stopPropagation();
    this.photoService.toggleLike(position);
  }

  openPreview(photo: UserPhoto, index: number) {
    this.previewPhoto.set(photo);
    this.previewIndex.set(index);
  }

  closePreview() {
    this.previewPhoto.set(null);
    this.previewIndex.set(-1);
  }

  async confirmDelete(photo: UserPhoto, index: number) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Eliminar Fotografía',
      subHeader: '¿Deseas remover esta foto de la galería?',
      buttons: [
        {
          text: 'Eliminar permanentemente',
          role: 'destructive',
          icon: 'trash',
          handler: async () => {
            await this.photoService.deletePhoto(photo, index);
            this.closePreview();
          },
        },
        {
          text: 'Conservar foto',
          icon: 'close',
          role: 'cancel',
        },
      ],
    });
    await actionSheet.present();
  }
}
