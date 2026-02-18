import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ConnectButton({
  connected,
  connecting,
  publicKey,
  onConnect,
  onDisconnect,
}: Props) {
  if (connecting) {
    return (
      <View style={[styles.button, styles.connecting]}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.buttonText}>Connecting...</Text>
      </View>
    );
  }

  if (connected && publicKey) {
    return (
      <TouchableOpacity
        style={[styles.button, styles.connected]}
        onPress={onDisconnect}
      >
        <Ionicons name="wallet" size={18} color="#14F195" />
        <Text style={styles.connectedText}>
          {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
        </Text>
        <Ionicons name="close-circle-outline" size={16} color="#888" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, styles.disconnected]}
      onPress={onConnect}
    >
      <Ionicons name="wallet-outline" size={18} color="#fff" />
      <Text style={styles.buttonText}>Connect Wallet</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
  },
  disconnected: {
    backgroundColor: "#9945FF",
    borderColor: "#9945FF",
  },
  connected: {
    backgroundColor: "rgba(20, 241, 149, 0.1)",
    borderColor: "#14F195",
  },
  connecting: {
    backgroundColor: "#16161D",
    borderColor: "#2A2A35",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  connectedText: {
    color: "#14F195",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "monospace",
  },
});
