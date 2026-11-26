package de.tiry.waschmaschine.protokoll

/** Ein erfundenes, aber realistisch aufgebautes Waschmaschinen-Profil für Tests. */
object Testgeraet {
    const val SCHLUESSEL = "Gq2V8n3x7Qk1LmP0aZbYcW9dEfGhIjKlMnOpQrStUvw"
    const val IV = "AAECAwQFBgcICQoLDA0ODw"

    const val OPERATION = 552; const val TUER = 527; const val REST = 544; const val FORTSCHRITT = 542
    const val AKTIV = 256; const val GEWAEHLT = 257; const val POWER = 539; const val FERNSTART = 517
    const val TEMP = 0x7d1; const val SCHLEUDER = 0x7d2; const val WASSERDRUCK = 0x4c3; const val AQUASTOP = 0x4c4
    const val BAUMWOLLE = 28718; const val PFLEGELEICHT = 28719
    const val PAUSE = 0x0221; const val FORTSETZEN = 0x0222; const val ABBRUCH = 0x0223

    val betrieb = mapOf(0 to "BSH.Common.EnumType.OperationState.Inactive", 1 to "BSH.Common.EnumType.OperationState.Ready",
        2 to "BSH.Common.EnumType.OperationState.DelayedStart", 3 to "BSH.Common.EnumType.OperationState.Run",
        4 to "BSH.Common.EnumType.OperationState.Pause", 5 to "BSH.Common.EnumType.OperationState.ActionRequired",
        6 to "BSH.Common.EnumType.OperationState.Finished", 7 to "BSH.Common.EnumType.OperationState.Error",
        8 to "BSH.Common.EnumType.OperationState.Aborting")
    val tuer = mapOf(0 to "BSH.Common.EnumType.DoorState.Open", 1 to "BSH.Common.EnumType.DoorState.Closed", 2 to "BSH.Common.EnumType.DoorState.Locked")
    val ereignis = mapOf(0 to "BSH.Common.EnumType.EventPresentState.Off", 1 to "BSH.Common.EnumType.EventPresentState.Present", 2 to "BSH.Common.EnumType.EventPresentState.Confirmed")
    val power = mapOf(1 to "BSH.Common.EnumType.PowerState.Off", 2 to "BSH.Common.EnumType.PowerState.On")
    val temp = mapOf(0 to "LaundryCare.Washer.EnumType.Temperature.Cold", 40 to "LaundryCare.Washer.EnumType.Temperature.GC40", 60 to "LaundryCare.Washer.EnumType.Temperature.GC60")
    val schleuder = mapOf(0 to "LaundryCare.Washer.EnumType.SpinSpeed.Off", 1400 to "LaundryCare.Washer.EnumType.SpinSpeed.RPM1400", 1000 to "LaundryCare.Washer.EnumType.SpinSpeed.RPM1000")

    val profil: GeraeteProfil by lazy {
        val m = GeraeteBeschreibung.lies(mappingXml().toByteArray(), beschreibungXml().toByteArray())
        GeraeteProfil(haId = "SIEMENS-WM14UR5EM2-TEST01", marke = "SIEMENS", typ = "Washer", schluessel = SCHLUESSEL,
            merkmale = m.merkmale, programme = m.programme)
    }
    val profilAes get() = profil.copy(iv = IV)

    private fun h(i: Int) = Integer.toHexString(i).padStart(4, '0')

    fun mappingXml(): String {
        val f = listOf(OPERATION to "BSH.Common.Status.OperationState", TUER to "BSH.Common.Status.DoorState",
            REST to "BSH.Common.Option.RemainingProgramTime", FORTSCHRITT to "BSH.Common.Option.ProgramProgress",
            AKTIV to "BSH.Common.Root.ActiveProgram", GEWAEHLT to "BSH.Common.Root.SelectedProgram",
            POWER to "BSH.Common.Setting.PowerState", FERNSTART to "BSH.Common.Status.RemoteControlStartAllowed",
            TEMP to "LaundryCare.Washer.Option.Temperature", SCHLEUDER to "LaundryCare.Washer.Option.SpinSpeed",
            WASSERDRUCK to "BSH.Common.Event.LowWaterPressure", AQUASTOP to "BSH.Common.Event.AquaStopOccured",
            BAUMWOLLE to "LaundryCare.Washer.Program.Cotton", PFLEGELEICHT to "LaundryCare.Washer.Program.EasyCare",
            PAUSE to "BSH.Common.Command.PauseProgram", FORTSETZEN to "BSH.Common.Command.ResumeProgram", ABBRUCH to "BSH.Common.Command.AbortProgram")
        fun en(id: Int, key: String, w: Map<Int, String>) =
            """<enumDescription refENID="${h(id)}" enumKey="$key">""" + w.entries.joinToString("") { """<enumMember refValue="${it.key}">${it.value}</enumMember>""" } + "</enumDescription>"
        return """<?xml version="1.0" encoding="UTF-8"?>
<featureMappingFile xmlns="http://www.bsh-group.com/homeconnect/feature">
<description><brand>SIEMENS</brand></description>
<featureDescription>${f.joinToString("") { """<feature refUID="${h(it.first)}">${it.second}</feature>""" }}</featureDescription>
<errorDescription><error refEID="0001">BSH.Common.Error.Test</error></errorDescription>
<enumDescriptionList>${en(1, "OperationState", betrieb)}${en(2, "DoorState", tuer)}${en(3, "Event", ereignis)}${en(4, "Power", power)}${en(5, "Temp", temp)}${en(6, "Spin", schleuder)}</enumDescriptionList>
</featureMappingFile>"""
    }

    fun beschreibungXml(): String = """<?xml version="1.0" encoding="UTF-8"?>
<device xmlns="http://www.bsh-group.com/homeconnect/device">
<description><type>Washer</type><brand>SIEMENS</brand><model>WM14UR5EM2</model><version>2</version><revision>0</revision></description>
<statusList uid="0001">
 <status uid="${h(OPERATION)}" refCID="03" refDID="80" access="read" available="true" enumerationType="0001"/>
 <status uid="${h(TUER)}" refCID="03" refDID="80" access="read" available="true" enumerationType="0002"/>
 <status uid="${h(FERNSTART)}" refCID="01" refDID="00" access="read" available="true"/>
</statusList>
<settingList><setting uid="${h(POWER)}" access="readWrite" available="true" enumerationType="0004"/></settingList>
<eventList>
 <event uid="${h(WASSERDRUCK)}" enumerationType="0003" handling="acknowledge" level="warning"/>
 <event uid="${h(AQUASTOP)}" enumerationType="0003" handling="acknowledge" level="alert"/>
</eventList>
<commandList><command uid="${h(PAUSE)}" access="writeOnly"/><command uid="${h(FORTSETZEN)}" access="writeOnly"/><command uid="${h(ABBRUCH)}" access="writeOnly"/></commandList>
<optionList>
 <option uid="${h(REST)}" access="read" available="true" min="0" max="86340"/>
 <option uid="${h(FORTSCHRITT)}" access="read" available="true" min="0" max="100"/>
 <option uid="${h(TEMP)}" access="readWrite" available="true" enumerationType="0005"/>
 <option uid="${h(SCHLEUDER)}" access="readWrite" available="true" enumerationType="0006"/>
</optionList>
<programGroup uid="0003">
 <program uid="${h(BAUMWOLLE)}" available="true" execution="selectAndStart"><option refUID="${h(TEMP)}"/><option refUID="${h(SCHLEUDER)}"/></program>
 <program uid="${h(PFLEGELEICHT)}" available="true" execution="selectAndStart"><option refUID="${h(TEMP)}"/></program>
</programGroup>
<activeProgram uid="${h(AKTIV)}" access="readWrite"/>
<selectedProgram uid="${h(GEWAEHLT)}" access="readWrite"/>
</device>"""
}
