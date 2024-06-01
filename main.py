from websocket_server import WebsocketServer

import json

bos_idler = []

clients_a = []

ws_id_and_room_id = []

# enter host
server = WebsocketServer(host="ip adress", port=86)


def replacechars(msg):
    message_replaced = msg
    message_replaced = message_replaced.replace(";", "&#59;")
    message_replaced = message_replaced.replace("<", "&lt;")
    message_replaced = message_replaced.replace(">", "&gt;")
    return message_replaced

def newclient(client, server):
    print("Client connected.")
    bos_idler.append(str(client['id']))

def messagerec(client, server, message):
    message_replaced = replacechars(message)

    if str(client['id']) in bos_idler:
        if json.loads(message_replaced)["nickname"] == "null" or json.loads(message_replaced)["nickname"] == "":
            server.send_message(client, json.dumps({ "nickname": "system", "msg": "Please Enter Nickname" }))
            return
        ws_id_and_room_id.append({"ws_id": str(client['id']), "room_id": json.loads(message_replaced)["msg"], "nickname": json.loads(message_replaced)["nickname"] })
        bos_idler.remove(str(client['id']))
        clients_a.append(client)

        for author_ws_id_and_room_id in ws_id_and_room_id:
            if str(client['id']) in author_ws_id_and_room_id["ws_id"]:
                roomid = author_ws_id_and_room_id["room_id"]
                nickname = author_ws_id_and_room_id["nickname"]
                for room_id_guild in ws_id_and_room_id:
                    if roomid == room_id_guild["room_id"]:
                        
                        for sending_client in clients_a:
                            if room_id_guild["ws_id"] == str(sending_client["id"]) and str(client["id"]) != str(sending_client["id"]):
                                server.send_message(sending_client, json.dumps({ "nickname": nickname, "msg": "Member Connected." }))
        return

    for author_ws_id_and_room_id in ws_id_and_room_id:

        if str(client['id']) in author_ws_id_and_room_id["ws_id"]:
            roomid = author_ws_id_and_room_id["room_id"]
            nickname = author_ws_id_and_room_id["nickname"]
            for room_id_guild in ws_id_and_room_id:
                if roomid == room_id_guild["room_id"]:
                    
                    for sending_client in clients_a:
                        if room_id_guild["ws_id"] == str(sending_client["id"]) and str(client["id"]) != str(sending_client["id"]):
                            server.send_message(sending_client, json.dumps({ "nickname": nickname, "msg": json.loads(message_replaced)["msg"] }))


        

def clientleft(client, server):
    for author_ws_id_and_room_id in ws_id_and_room_id:

        if str(client['id']) in author_ws_id_and_room_id["ws_id"]:
            roomid = author_ws_id_and_room_id["room_id"]
            nickname = author_ws_id_and_room_id["nickname"]

            for room_id_guild in ws_id_and_room_id:
                if roomid == room_id_guild["room_id"]:
                    
                    for sending_client in clients_a:
                        if room_id_guild["ws_id"] == str(sending_client["id"]) and str(client["id"]) != str(sending_client["id"]):
                            server.send_message(sending_client, json.dumps({ "nickname": nickname, "msg": "Member Disconnected." }))

            
    clients_a.remove(client)


server.set_fn_new_client(newclient)
server.set_fn_message_received(messagerec)
server.set_fn_client_left(clientleft)

server.run_forever()


