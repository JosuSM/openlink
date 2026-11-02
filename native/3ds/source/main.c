#include <3ds.h>
#include <3ds/services/httpc.h>
#include <3ds/services/sslc.h>
#include <stdio.h>
#include <string.h>

#include "../openlink_protocol.h"

static OpenLinkPlayerState player_state;

static Result check_openlink_server(u32 *status_code) {
    httpcContext context;
    Result result = httpcOpenContext(&context, HTTPC_METHOD_GET, OPENLINK_SERVER_URL, 0);
    if (R_FAILED(result)) {
        return result;
    }

    if (strncmp(OPENLINK_SERVER_URL, "https://", 8) == 0) {
        httpcAddDefaultCert(&context, SSLC_DefaultRootCert_USERTrust);
        httpcAddDefaultCert(&context, SSLC_DefaultRootCert_DigiCert_EV);
    }

    result = httpcBeginRequest(&context);
    if (R_SUCCEEDED(result)) {
        result = httpcGetResponseStatusCode(&context, status_code);
    }
    if (R_SUCCEEDED(result)) {
        u8 response[128];
        result = httpcReceiveData(&context, response, sizeof(response));
    }

    httpcCloseContext(&context);
    return result;
}

static void update_player_state(u32 keys_down) {
    player_state.buttons = (uint16_t)(keys_down & 0xffff);
    player_state.sequence += 1;

    if (keys_down & KEY_DUP) {
        player_state.y -= 1;
    }
    if (keys_down & KEY_DDOWN) {
        player_state.y += 1;
    }
    if (keys_down & KEY_DLEFT) {
        player_state.x -= 1;
    }
    if (keys_down & KEY_DRIGHT) {
        player_state.x += 1;
    }
}

int main(void) {
    gfxInitDefault();
    consoleInit(GFX_TOP, NULL);

    Result http_result = httpcInit(0);
    u32 http_status = 0;

    printf("OpenLink 3DS\n");
    printf("Protocol: %d\n", OPENLINK_PROTOCOL_VERSION);
    printf("Native homebrew client scaffold\n\n");

    if (R_SUCCEEDED(http_result)) {
        http_result = check_openlink_server(&http_status);
    }
    if (R_SUCCEEDED(http_result)) {
        printf("Server: HTTP %lu\n\n", (unsigned long)http_status);
    } else {
        printf("Server: unavailable (0x%08lx)\n\n", (unsigned long)http_result);
    }

    printf("D-pad moves the local player.\n");
    printf("START exits.\n\n");

    while (aptMainLoop()) {
        hidScanInput();
        const u32 keys_down = hidKeysDown();
        if (keys_down & KEY_START) {
            break;
        }

        update_player_state(keys_down);
        printf("Player state: (%d, %d)  sequence: %lu\n",
               player_state.x,
               player_state.y,
               (unsigned long)player_state.sequence);

        gfxFlushBuffers();
        gfxSwapBuffers();
        gspWaitForVBlank();
    }

    gfxExit();
    httpcExit();
    return 0;
}
