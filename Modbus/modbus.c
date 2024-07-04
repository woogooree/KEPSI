#include <stdio.h>      // 표준 입출력 함수 사용
#include <stdint.h>     // 정수형 타입 정의
#include <windows.h>    // Windows API 사용

// CRC 계산 함수
uint16_t calculateCRC(uint8_t *data, uint8_t length) {
    uint16_t crc = 0xFFFF;  // CRC 초기값 설정
    for (uint8_t i = 0; i < length; i++) {
        crc ^= data[i];  // 데이터와 CRC 값 XOR 연산
        for (uint8_t j = 0; j < 8; j++) {
            if (crc & 0x0001) {
                crc >>= 1;
                crc ^= 0xA001;   // 하위 비트가 1이면 CRC 보정
            } else {
                crc >>= 1;       // 하위 비트가 0이면 비트 시프트
            }
        }
    }
    return crc;  // 계산된 CRC 반환
}

// COM 포트 설정 함수
HANDLE setupSerialPort(const char* portName) {
    // 지정된 COM 포트를 여는 함수
    HANDLE hSerial = CreateFile(
        portName,  // 포트 이름
        GENERIC_READ | GENERIC_WRITE,  // 읽기 및 쓰기 설정
        0,  // 공유 모드 없음
        NULL,  // 보안 속성 없음
        OPEN_EXISTING,  // 기존 포트 열기
        FILE_ATTRIBUTE_NORMAL,  // 일반 파일 속성
        NULL  // 템플릿 파일 없음
    );

    if (hSerial == INVALID_HANDLE_VALUE) {
        return INVALID_HANDLE_VALUE;
    }

    // 포트 설정
    DCB dcbSerialParams = {0};
    dcbSerialParams.DCBlength = sizeof(dcbSerialParams);
    if (!GetCommState(hSerial, &dcbSerialParams)) {
        CloseHandle(hSerial);
        return INVALID_HANDLE_VALUE;
    }

    dcbSerialParams.BaudRate = CBR_9600;
    dcbSerialParams.ByteSize = 8;
    dcbSerialParams.StopBits = ONESTOPBIT;
    dcbSerialParams.Parity = NOPARITY;

    if (!SetCommState(hSerial, &dcbSerialParams)) {
        CloseHandle(hSerial);
        return INVALID_HANDLE_VALUE;
    }

    // 포트 타임아웃 설정
    COMMTIMEOUTS timeouts = {0};
    timeouts.ReadIntervalTimeout = 50;  // 연속된 문자 읽기 사이의 최대 시간 (ms)
    timeouts.ReadTotalTimeoutConstant = 50;  // 읽기 작업의 전체 시간 상수 (ms)
    timeouts.ReadTotalTimeoutMultiplier = 10;  // 읽기 작업의 전체 시간 배수 (ms/byte)
    timeouts.WriteTotalTimeoutConstant = 50;  // 쓰기 작업의 전체 시간 상수 (ms)
    timeouts.WriteTotalTimeoutMultiplier = 10;  // 쓰기 작업의 전체 시간 배수 (ms/byte)

    if (!SetCommTimeouts(hSerial, &timeouts)) {
        CloseHandle(hSerial);
        return INVALID_HANDLE_VALUE;
    }

    return hSerial;
}

// Modbus RTU 요청 전송 함수
void sendModbusRequest(HANDLE hSerial, uint8_t slaveAddress, uint16_t startAddress, uint16_t registerCount) {
    uint8_t request[8];  // 요청 프레임 (8바이트)

    // 요청 프레임 구성
    request[0] = slaveAddress;  // 슬레이브 주소 설정
    request[1] = 0x04;  // 기능 코드 설정 (0x04: Read Input Registers)
    request[2] = (startAddress >> 8) & 0xFF;  // 시작 주소 상위 바이트 설정
    request[3] = startAddress & 0xFF;  // 시작 주소 하위 바이트 설정
    request[4] = (registerCount >> 8) & 0xFF;  // 레지스터 수 상위 바이트 설정
    request[5] = registerCount & 0xFF;  // 레지스터 수 하위 바이트 설정

    // CRC 계산
    uint16_t crc = calculateCRC(request, 6);
    request[6] = crc & 0xFF;  // CRC 하위 바이트
    request[7] = (crc >> 8) & 0xFF;  // CRC 상위 바이트

    // 요청 프레임 전송
    DWORD bytesWritten;
    if (!WriteFile(hSerial, request, sizeof(request), &bytesWritten, NULL)) {
        // 전송 실패 시 에러 메시지 출력
        printf("Failed to write to COM port\n");
    } else {
        // 전송 성공 시 메시지 출력
        printf("Modbus RTU Request sent\n");
    }
}

int main() {
    // COM 포트 설정
    HANDLE hSerial = setupSerialPort("COM4");

    // 포트 열기 실패 시 프로그램 종료
    if (hSerial == INVALID_HANDLE_VALUE) {
        printf("Error opening COM port\n");
        return 1;
    }

    // 슬레이브 주소, 시작 주소, 레지스터 수 설정
    uint8_t slaveAddress = 0x01;  // 슬레이브 주소
    uint16_t startAddress = 0x0002;  // 시작 주소 (30003 레지스터의 실제 주소 W가 저장됨)
    uint16_t registerCount = 0x0001;  // 요청할 레지스터 수


    while (1) {
        // Modbus RTU 요청 전송
        sendModbusRequest(hSerial, slaveAddress, startAddress, registerCount);


        Sleep(360000);
    }

    CloseHandle(hSerial);
    return 0;
}