declare module "piexifjs" {
  export type ExifDict = {
    "0th"?: Record<number, unknown>;
    Exif?: Record<number, unknown>;
    GPS?: Record<number, unknown>;
    Interop?: Record<number, unknown>;
    "1st"?: Record<number, unknown>;
    thumbnail?: string | null;
  };

  const piexif: {
    version: string;
    ImageIFD: Record<string, number>;
    ExifIFD: Record<string, number>;
    GPSIFD: Record<string, number>;
    InteropIFD: Record<string, number>;
    TAGS: Record<string, Record<number, { name: string; type: string }>>;
    GPSHelper: {
      degToDmsRational(degFloat: number): [[number, number], [number, number], [number, number]];
      dmsRationalToDeg(dmsArray: [[number, number], [number, number], [number, number]], ref: string): number;
    };
    load(data: string): ExifDict;
    dump(exif: ExifDict): string;
    insert(exif: string, data: string): string;
    remove(data: string): string;
  };

  export default piexif;
}
