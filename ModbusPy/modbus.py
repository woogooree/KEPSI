import minimalmodbus as modbus
import serial
import time
import schedule

modbus.MODE_RTU= 'rtu'

# if __name__ == '__main__' :
def readData() :
    instrument = modbus.Instrument('COM4', 2, 'rtu')
    instrument.serial.baudrate = 9600
    instrument.serial.bytesize = 8
    instrument.serial.parity = serial.PARITY_NONE
    instrument.serial.stopbits = 1
    instrument.serial.timeout = 1 #seconds
    instrument.address = 1
    instrument.mode = modbus.MODE_RTU

    try :
        print(instrument.read_register(registeraddress=30007, number_of_decimals=0, functioncode=int('0x04', 16), signed=False))
    except IOError :
        print("Failed to Read")

# Scheduler 설정
schedule.every(3).seconds.do(readData)

while 1 :
    schedule.run_pending()
    time.sleep

