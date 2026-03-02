// app/(tabs)/swap.tsx
// swap screen with jupiter dex aggregator integration
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  TOKENS,
  TOKEN_INFO,
  AVAILABLE_TOKENS,
  fromSmallestUnit,
} from "../../src/services/jupiter";
import { useWallet } from "../../src/hooks/useWallet";
import { useWalletStore } from "../../src/stores/wallet-store";

export default function SwapScreen() {
  const wallet = useWallet();
  const isDevnet = useWalletStore((s) => s.isDevnet);

  // token selection
  const [inputToken, setInputToken] = useState(TOKENS.SOL);
  const [outputToken, setOutputToken] = useState(TOKENS.USDC);

  // amounts
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");

  // token picker modal
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"input" | "output">("input");

  const inputInfo = TOKEN_INFO[inputToken];
  const outputInfo = TOKEN_INFO[outputToken];

  // fetch quote when input amount changes (debounced)
  const fetchQuote = useCallback(async () => {
    if (!inputAmount || Number(inputAmount) <= 0) {
      setOutputAmount("");
      wallet.clearQuote();
      return;
    }

    if (isDevnet) {
      setOutputAmount("N/A (Devnet)");
      wallet.clearQuote();
      return;
    }

    try {
      const quote = await wallet.fetchSwapQuote(
        inputToken,
        outputToken,
        Number(inputAmount),
        inputInfo.decimals
      );

      if (quote) {
        const outValue = fromSmallestUnit(quote.outAmount, outputInfo.decimals);
        setOutputAmount(outValue.toFixed(outputInfo.decimals > 6 ? 4 : 2));
      }
    } catch {
      setOutputAmount("Error");
    }
  }, [inputAmount, inputToken, outputToken, inputInfo, outputInfo, isDevnet, wallet]);

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  // flip tokens
  const flipTokens = () => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setInputAmount(outputAmount);
    setOutputAmount("");
    wallet.clearQuote();
  };

  // token picker
  const openPicker = (target: "input" | "output") => {
    setPickerTarget(target);
    setPickerVisible(true);
  };

  const selectToken = (mint: string) => {
    if (pickerTarget === "input") {
      if (mint === outputToken) setOutputToken(inputToken);
      setInputToken(mint);
    } else {
      if (mint === inputToken) setInputToken(outputToken);
      setOutputToken(mint);
    }
    setPickerVisible(false);
    wallet.clearQuote();
    setOutputAmount("");
  };

  // execute swap
  const handleSwap = async () => {
    if (!wallet.connected) {
      return Alert.alert("Connect Wallet", "Connect your wallet first to swap");
    }

    if (isDevnet) {
      return Alert.alert(
        "Mainnet Only",
        "Jupiter swaps only work on Mainnet. Switch to Mainnet in settings."
      );
    }

    if (!wallet.quoteData) {
      return Alert.alert("No Quote", "Enter an amount to get a quote first");
    }

    try {
      const result = await wallet.executeSwap(
        wallet.quoteData,
        inputInfo.symbol,
        outputInfo.symbol,
        outputInfo.decimals
      );

      Alert.alert(
        "Swap Successful!",
        `Swapped ${inputAmount} ${result.inputSymbol} for ${result.outputAmount.toFixed(4)} ${result.outputSymbol}`,
        [{ text: "OK" }]
      );

      setInputAmount("");
      setOutputAmount("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      Alert.alert("Swap Failed", message);
    }
  };

  // token picker modal
  const renderTokenPicker = () => (
    <Modal
      visible={pickerVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setPickerVisible(false)}
    >
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Token</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={AVAILABLE_TOKENS}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const info = TOKEN_INFO[item];
              const isSelected =
                pickerTarget === "input" ? item === inputToken : item === outputToken;
              return (
                <TouchableOpacity
                  style={[s.tokenOption, isSelected && s.tokenOptionSelected]}
                  onPress={() => selectToken(item)}
                >
                  <View style={[s.tokenIcon, { backgroundColor: info.color }]}>
                    <Text style={s.tokenIconText}>{info.symbol[0]}</Text>
                  </View>
                  <View style={s.tokenOptionInfo}>
                    <Text style={s.tokenOptionSymbol}>{info.symbol}</Text>
                    <Text style={s.tokenOptionName}>{info.name}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color="#14F195" />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.title}>Swap Tokens</Text>

        {isDevnet && (
          <View style={s.devnetWarning}>
            <Ionicons name="warning" size={16} color="#F59E0B" />
            <Text style={s.devnetText}>
              Jupiter only works on Mainnet. Switch network to swap.
            </Text>
          </View>
        )}

        {/* From Token Card */}
        <Animated.View
          style={[s.card, { marginBottom: 10 }]}
          entering={FadeInDown.delay(100).springify()}
        >
          <View style={s.cardHeader}>
            <TouchableOpacity style={s.tokenSelector} onPress={() => openPicker("input")}>
              <View style={[s.tokenIcon, { backgroundColor: inputInfo.color }]}>
                <Text style={s.tokenIconText}>{inputInfo.symbol[0]}</Text>
              </View>
              <Text style={s.tokenName}>{inputInfo.symbol}</Text>
              <Ionicons name="chevron-down" size={18} color="#888" />
            </TouchableOpacity>
            <TextInput
              style={s.amountInput}
              value={inputAmount}
              onChangeText={setInputAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#666"
            />
          </View>
          <View style={s.cardFooter}>
            <Text style={s.labelText}>You Pay</Text>
          </View>
        </Animated.View>

        {/* Swap Arrow */}
        <Animated.View
          style={s.arrowContainer}
          entering={FadeInDown.delay(150).springify()}
        >
          <TouchableOpacity style={s.swapArrow} onPress={flipTokens}>
            <Ionicons name="swap-vertical" size={20} color="#14F195" />
          </TouchableOpacity>
        </Animated.View>

        {/* To Token Card */}
        <Animated.View
          style={s.card}
          entering={FadeInDown.delay(200).springify()}
        >
          <View style={s.cardHeader}>
            <TouchableOpacity style={s.tokenSelector} onPress={() => openPicker("output")}>
              <View style={[s.tokenIcon, { backgroundColor: outputInfo.color }]}>
                <Text style={s.tokenIconText}>{outputInfo.symbol[0]}</Text>
              </View>
              <Text style={s.tokenName}>{outputInfo.symbol}</Text>
              <Ionicons name="chevron-down" size={18} color="#888" />
            </TouchableOpacity>
            <View style={s.outputContainer}>
              {wallet.quoteLoading ? (
                <ActivityIndicator color="#14F195" size="small" />
              ) : (
                <Text style={s.outputText}>{outputAmount || "0"}</Text>
              )}
            </View>
          </View>
          <View style={s.cardFooter}>
            <Text style={s.labelText}>You Receive</Text>
          </View>
        </Animated.View>

        {/* Quote Details */}
        {wallet.quoteData && (
          <Animated.View
            style={s.detailsCard}
            entering={FadeInDown.delay(250).springify()}
          >
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Rate</Text>
              <Text style={s.detailValue}>
                1 {inputInfo.symbol} ={" "}
                {(Number(outputAmount) / Number(inputAmount)).toFixed(4)} {outputInfo.symbol}
              </Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Price Impact</Text>
              <Text
                style={[
                  s.detailValue,
                  Number(wallet.quoteData.priceImpactPct) > 1 && { color: "#EF4444" },
                ]}
              >
                {Number(wallet.quoteData.priceImpactPct).toFixed(2)}%
              </Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Slippage Tolerance</Text>
              <Text style={s.detailValue}>0.5%</Text>
            </View>
            {wallet.quoteData.routePlan?.length > 0 && (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Route</Text>
                <Text style={s.detailValue}>
                  {wallet.quoteData.routePlan.map((r) => r.swapInfo.label).join(" -> ")}
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Swap Button */}
        {wallet.connected ? (
          <TouchableOpacity
            style={[
              s.swapBtn,
              (!wallet.quoteData || wallet.swapping || isDevnet) && s.swapBtnDisabled,
            ]}
            onPress={handleSwap}
            disabled={!wallet.quoteData || wallet.swapping || isDevnet}
          >
            {wallet.swapping ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={s.swapBtnText}>
                {isDevnet
                  ? "Switch to Mainnet"
                  : wallet.quoteData
                    ? "Swap"
                    : "Enter an amount"}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={s.connectBtn}
            onPress={wallet.connect}
            disabled={wallet.connecting}
          >
            {wallet.connecting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.connectBtnText}>Connect Wallet to Swap</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {renderTokenPicker()}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  // layout
  safe: {
    flex: 1,
    backgroundColor: "#0D0D12",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // header
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 20,
  },

  // devnet warning
  devnetWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  devnetText: {
    color: "#F59E0B",
    fontSize: 13,
    flex: 1,
  },

  // token card
  card: {
    backgroundColor: "#1A1A24",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A35",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },

  // token selector
  tokenSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252530",
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 6,
  },
  tokenIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenIconText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  tokenName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // amount input/output
  amountInput: {
    fontSize: 36,
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "right",
    flex: 1,
    marginLeft: 10,
  },
  outputContainer: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 44,
  },
  outputText: {
    fontSize: 36,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  labelText: {
    fontSize: 13,
    color: "#6B7280",
    textTransform: "uppercase",
  },

  // swap arrow
  arrowContainer: {
    alignItems: "center",
    marginVertical: -22,
    zIndex: 10,
  },
  swapArrow: {
    backgroundColor: "#0D0D12",
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#1A1A24",
  },

  // quote details
  detailsCard: {
    backgroundColor: "#1A1A24",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#2A2A35",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  detailLabel: {
    color: "#6B7280",
    fontSize: 13,
  },
  detailValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
    maxWidth: "60%",
    textAlign: "right",
  },

  // buttons
  swapBtn: {
    backgroundColor: "#14F195",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 24,
  },
  swapBtnDisabled: {
    opacity: 0.4,
  },
  swapBtnText: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "600",
  },
  connectBtn: {
    backgroundColor: "#9945FF",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 24,
  },
  connectBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },

  // modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1A1A24",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A35",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
  },

  // token option list
  tokenOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A35",
  },
  tokenOptionSelected: {
    backgroundColor: "rgba(20, 241, 149, 0.1)",
  },
  tokenOptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tokenOptionSymbol: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  tokenOptionName: {
    color: "#6B7280",
    fontSize: 13,
    marginTop: 2,
  },
});
