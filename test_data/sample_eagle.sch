<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE eagle SYSTEM "eagle.dtd">
<eagle version="9.6.2">
<drawing>
<schematic>
<libraries>
<library name="resistor">
<devicesets>
<deviceset name="R-US" prefix="R" uservalue="yes">
<devices>
<device name="0805" package="0805">
</device>
</devices>
</deviceset>
</devicesets>
</library>
</libraries>
<parts>
<part name="R1" library="resistor" deviceset="R-US" device="0805" value="10k">
<attribute name="PARTNUMBER" value="RC0805FR-0710KL"/>
<attribute name="MANUFACTURER" value="Yageo"/>
</part>
<part name="R2" library="resistor" deviceset="R-US" device="0805" value="10k">
<attribute name="PARTNUMBER" value="RC0805FR-0710KL"/>
<attribute name="MANUFACTURER" value="Yageo"/>
</part>
<part name="C1" library="capacitor" deviceset="C-US" device="0603" value="100nF">
<attribute name="PARTNUMBER" value="GRM188R71C104KA01D"/>
<attribute name="MANUFACTURER" value="Murata"/>
</part>
<part name="U1" library="microcontroller" deviceset="STM32F401" device="UFQFPN48" value="STM32F401CCUx">
<attribute name="PARTNUMBER" value="STM32F401CCU6"/>
<attribute name="MANUFACTURER" value="STMicroelectronics"/>
</part>
<part name="LED1" library="led" deviceset="LED" device="0805" value="RED">
<attribute name="PARTNUMBER" value="LTST-C170KRKT"/>
<attribute name="MANUFACTURER" value="Lite-On"/>
</part>
</parts>
</schematic>
</drawing>
</eagle>
