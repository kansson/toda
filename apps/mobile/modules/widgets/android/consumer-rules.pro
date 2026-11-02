# Glance renders and schedules its updates with WorkManager, which creates its Room database,
# input mergers and workers by reflection. R8 would otherwise strip those constructors: the app
# would not open, and a widget would stay on its loading layout.
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class * extends androidx.work.InputMerger { <init>(); }
-keep class * extends androidx.work.ListenableWorker {
  <init>(android.content.Context, androidx.work.WorkerParameters);
}
# A widget's check box names its callback by class, and Glance creates it by reflection.
-keep class * implements androidx.glance.appwidget.action.ActionCallback { <init>(); }
