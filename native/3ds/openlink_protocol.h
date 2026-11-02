#ifndef OPENLINK_PROTOCOL_H
#define OPENLINK_PROTOCOL_H

#include <stdint.h>

#define OPENLINK_PROTOCOL_VERSION 1
#define OPENLINK_GAME_ID_MAX 32
#define OPENLINK_DISPLAY_NAME_MAX 24
#define OPENLINK_PAYLOAD_MAX 512

typedef enum OpenLinkPlatform {
    OPENLINK_PLATFORM_3DS = 1,
    OPENLINK_PLATFORM_SWITCH = 2
} OpenLinkPlatform;

typedef enum OpenLinkMessageType {
    OPENLINK_MESSAGE_HELLO = 1,
    OPENLINK_MESSAGE_JOIN = 2,
    OPENLINK_MESSAGE_PLAYER_STATE = 3,
    OPENLINK_MESSAGE_ENCOUNTER = 4,
    OPENLINK_MESSAGE_GOODBYE = 5
} OpenLinkMessageType;

typedef struct OpenLinkPlayerState {
    int16_t x;
    int16_t y;
    uint16_t buttons;
    uint32_t sequence;
} OpenLinkPlayerState;

typedef struct OpenLinkEncounter {
    char game_id[OPENLINK_GAME_ID_MAX];
    uint8_t payload[OPENLINK_PAYLOAD_MAX];
    uint16_t payload_size;
    uint32_t encounter_id;
} OpenLinkEncounter;

#endif
