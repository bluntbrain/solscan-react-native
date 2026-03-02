// src/components/SwipeableHistoryItem.tsx
// swipeable list item with gesture handler - swipe left to delete
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const short = (s: string, n = 4) => `${s.slice(0, n)}...${s.slice(-n)}`;

interface SwipeableHistoryItemProps {
  address: string;
  index: number;
  onPress: () => void;
  onDelete: () => void;
}

export function SwipeableHistoryItem({
  address,
  index,
  onPress,
  onDelete,
}: SwipeableHistoryItemProps) {
  const translateX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      // only allow left swipe (negative X)
      translateX.value = Math.min(0, event.translationX);
    })
    .onEnd((event) => {
      if (event.translationX < -100) {
        // swiped far enough - delete
        translateX.value = withSpring(-300);
        runOnJS(onDelete)();
      } else {
        // snap back
        translateX.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / 100),
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(150 + index * 50).springify()}
      style={styles.container}
    >
      {/* delete background */}
      <Animated.View style={[styles.deleteBackground, deleteStyle]}>
        <Ionicons name="trash" size={20} color="#fff" />
        <Text style={styles.deleteText}>Delete</Text>
      </Animated.View>

      {/* swipeable card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardStyle}>
          <TouchableOpacity style={styles.item} onPress={onPress}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.address} numberOfLines={1}>
              {short(address, 8)}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#6B7280" />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    position: "relative",
  },
  deleteBackground: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  deleteText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16161D",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A35",
    gap: 12,
  },
  address: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "monospace",
  },
});
