import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import PagerView from 'react-native-pager-view';
import { CyberTheme } from '../theme/colors';

// Import Screens (or placeholder containers)
interface SwipeNavigatorProps {
  renderChatsScreen: () => React.ReactNode;
  renderCameraScreen: () => React.ReactNode;
  renderDiscoverScreen: () => React.ReactNode;
  activeStreakCount?: number;
}

const { width } = Dimensions.get('window');

export const SwipeNavigator: React.FC<SwipeNavigatorProps> = ({
  renderChatsScreen,
  renderCameraScreen,
  renderDiscoverScreen,
  activeStreakCount = 42,
}) => {
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState<number>(1); // Default to Camera (Index 1)

  const goToPage = (pageIndex: number) => {
    pagerRef.current?.setPage(pageIndex);
    setCurrentPage(pageIndex);
  };

  return (
    <View style={styles.container}>
      {/* Top Floating Cyber Navigation Pill */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => goToPage(0)}
          style={[
            styles.navPill,
            currentPage === 0 && styles.activePillPink,
          ]}
        >
          <Text
            style={[
              styles.navText,
              currentPage === 0 && { color: CyberTheme.neonPink, fontWeight: 'bold' },
            ]}
          >
            Chats
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => goToPage(1)}
          style={[
            styles.navPill,
            currentPage === 1 && styles.activePillWhite,
          ]}
        >
          <Text
            style={[
              styles.navText,
              currentPage === 1 && { color: '#FFFFFF', fontWeight: 'bold' },
            ]}
          >
            Snap
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => goToPage(2)}
          style={[
            styles.navPill,
            currentPage === 2 && styles.activePillCyan,
          ]}
        >
          <Text
            style={[
              styles.navText,
              currentPage === 2 && { color: CyberTheme.neonCyan, fontWeight: 'bold' },
            ]}
          >
            Stories & 🔥
          </Text>
        </TouchableOpacity>
      </View>

      {/* Snapchat-Style Horizontal Paging View */}
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={1}
        onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
      >
        {/* Page 0: Encrypted Chats & Streaks */}
        <View key="0" style={styles.pageContainer}>
          {renderChatsScreen()}
        </View>

        {/* Page 1: Fast Camera Viewfinder & Streak Snaps */}
        <View key="1" style={styles.pageContainer}>
          {renderCameraScreen()}
        </View>

        {/* Page 2: 24h Stories, Discover & Streak Leaderboard */}
        <View key="2" style={styles.pageContainer}>
          {renderDiscoverScreen()}
        </View>
      </PagerView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CyberTheme.background,
  },
  headerBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(13, 13, 22, 0.75)',
    borderRadius: 30,
    padding: 4,
    borderWidth: 1,
    borderColor: CyberTheme.surfaceBorder,
  },
  navPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 20,
  },
  activePillPink: {
    backgroundColor: CyberTheme.neonPinkMuted,
    borderWidth: 1,
    borderColor: CyberTheme.neonPink,
  },
  activePillWhite: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  activePillCyan: {
    backgroundColor: CyberTheme.neonCyanMuted,
    borderWidth: 1,
    borderColor: CyberTheme.neonCyan,
  },
  navText: {
    fontSize: 13,
    color: CyberTheme.textSecondary,
  },
  pagerView: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
    width,
  },
});
