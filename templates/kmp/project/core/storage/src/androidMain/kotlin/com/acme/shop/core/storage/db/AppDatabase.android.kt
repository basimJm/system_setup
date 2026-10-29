package com.acme.shop.core.storage.db

import android.content.Context
import androidx.room.Room
import androidx.room.RoomDatabase
import org.koin.mp.KoinPlatform

fun getDatabaseBuilder(context: Context): RoomDatabase.Builder<AppDatabase> {
    val appContext = context.applicationContext
    val dbFile = appContext.getDatabasePath("my_room.db")
    return Room.databaseBuilder<AppDatabase>(
        context = appContext,
        name = dbFile.absolutePath
    ).fallbackToDestructiveMigration(dropAllTables = true)
}

actual fun getDatabaseBuilder(): RoomDatabase.Builder<AppDatabase> {
    val context = KoinPlatform.getKoin().getProperty<Context>("androidContext")
    return getDatabaseBuilder(context as Context)
}
